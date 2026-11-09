import "dotenv/config";

import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { v2 as cloudinary } from "cloudinary";

import type { ImageProvider } from "@/modules/image-uploads";
import {
  cloudinaryConfigFromEnv,
  createCloudinaryProvider,
} from "@/modules/image-uploads/providers/cloudinary";
import {
  MAX_DELETABLE_RATIO_PERCENT,
  sweepOrphanImages,
} from "@/lib/images/orphan-sweep";
import type {
  OrphanSweepOk,
  SweepAssetDecision,
} from "@/lib/images/orphan-sweep";

/**
 * One-off sweep for legacy orphan images.
 *
 * An orphan here is narrow: an asset in the deployment's Cloudinary folder that
 * no `Car.images` lists *and* that has no `ImageUpload` row. Assets with a row
 * are modern orphans — the app already deletes those — so the sweep leaves them
 * alone.
 *
 * The script is a thin shell on purpose. Every rule, including both aborts,
 * lives in `src/lib/images/orphan-sweep.ts` where vitest can reach it without a
 * database or Cloudinary credentials. This file only parses flags, loads data,
 * prints, writes the report and — with `--confirm` — deletes.
 *
 * Dry run is the default: the report is written in both modes, and no asset is
 * removed unless `--confirm` is present.
 */

const DEFAULT_FOLDER = "car-agency-app";
const DEFAULT_OLDER_THAN_DAYS = 7;
const DEFAULT_REPORT_PATH = "orphan-sweep-report.json";

/** The provider's own delete concurrency is 8; 50 keys per call amortises it. */
const DELETE_BATCH_SIZE = 50;
const LIST_PAGE_SIZE = 500;

const USAGE = `Usage: pnpm sweep:orphans [options]

Lists the assets in one Cloudinary folder and deletes the legacy orphans: the
ones no car lists and that have no ImageUpload row. Dry run by default —
nothing is deleted without --confirm.

Options:
  --confirm                 Delete the selected assets. Without this flag the
                            sweep only reports and writes the report.
  --older-than-days=<n>     Ignore assets younger than <n> whole days.
                            Default: ${DEFAULT_OLDER_THAN_DAYS}.
  --folder=<name>           Cloudinary folder to sweep.
                            Default: ${DEFAULT_FOLDER}.
  --report=<path>           Where to write the JSON report.
                            Default: ${DEFAULT_REPORT_PATH}. Deletion outcomes
                            are appended next to it, as <report>.delete-log.jsonl.
  --allow-high-ratio        Continue even when more than ${MAX_DELETABLE_RATIO_PERCENT}% of the assets
                            look orphaned. Use only after confirming the
                            database and the folder belong together.
  --help                    Print this message and exit 0.
`;

interface SweepOptions {
  readonly confirm: boolean;
  readonly olderThanDays: number;
  readonly folder: string;
  readonly reportPath: string;
  readonly allowHighRatio: boolean;
}

type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "options"; readonly options: SweepOptions }
  | { readonly kind: "error"; readonly message: string };

/** An expected failure: printed as one readable line, without a stack trace. */
class SweepFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SweepFailure";
  }
}

interface CloudinaryResource {
  readonly public_id: string;
  readonly created_at: string;
  readonly bytes: number;
}

interface CloudinaryResourcesPage {
  readonly resources?: readonly CloudinaryResource[];
  readonly next_cursor?: string;
}

interface ListedAsset {
  readonly publicId: string;
  readonly createdAt: string;
  readonly bytes: number;
}

interface DatabaseKeys {
  readonly referenced: ReadonlySet<string>;
  readonly recorded: ReadonlySet<string>;
  readonly close: () => Promise<void>;
}

interface DeleteOutcome {
  readonly publicId: string;
  readonly key: string;
  readonly outcome: "deleted" | "failed";
  readonly error?: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let confirm = false;
  let allowHighRatio = false;
  let olderThanDays = DEFAULT_OLDER_THAN_DAYS;
  let folder = DEFAULT_FOLDER;
  let reportPath = DEFAULT_REPORT_PATH;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { kind: "help" };
    if (arg === "--confirm") {
      confirm = true;
      continue;
    }
    if (arg === "--allow-high-ratio") {
      allowHighRatio = true;
      continue;
    }

    const separator = arg.indexOf("=");
    const name = separator === -1 ? arg : arg.slice(0, separator);
    const value = separator === -1 ? undefined : arg.slice(separator + 1);

    if (name === "--older-than-days") {
      if (value === undefined || !/^\d+$/.test(value)) {
        return {
          kind: "error",
          message: `--older-than-days needs a whole number of days, e.g. --older-than-days=7 (got ${
            value ?? "nothing"
          }).`,
        };
      }
      olderThanDays = Number.parseInt(value, 10);
      continue;
    }

    if (name === "--folder") {
      if (value === undefined || value.trim() === "") {
        return {
          kind: "error",
          message: "--folder needs a non-empty Cloudinary folder name.",
        };
      }
      folder = value;
      continue;
    }

    if (name === "--report") {
      if (value === undefined || value.trim() === "") {
        return { kind: "error", message: "--report needs a non-empty path." };
      }
      reportPath = value;
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    }

    return { kind: "error", message: `Unexpected argument: ${arg}` };
  }

  return {
    kind: "options",
    options: {
      confirm,
      olderThanDays,
      folder: folder.replace(/\/+$/, ""),
      reportPath,
      allowHighRatio,
    },
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.kind === "help") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n\n${USAGE}`);
    return 2;
  }

  try {
    return await run(parsed.options);
  } catch (error) {
    if (error instanceof SweepFailure) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }

    process.stderr.write(
      `The sweep failed unexpectedly: ${describeError(error)}\n`,
    );
    return 1;
  }
}

async function run(options: SweepOptions): Promise<number> {
  // Imported lazily: `@/lib/db` builds a Prisma client (and reads DATABASE_URL)
  // while it is evaluated, and `--help` must not need either.
  const database = await openDatabase();

  try {
    const provider = buildProvider(options.folder);
    const assets = await listAssets(options.folder);

    const result = sweepOrphanImages({
      folder: options.folder,
      assets,
      referencedKeys: database.referenced,
      recordedKeys: database.recorded,
      olderThanDays: options.olderThanDays,
      // One timestamp for the whole decision, so the printed report, the JSON
      // and the age boundary cannot disagree.
      now: Date.now(),
      allowHighRatio: options.allowHighRatio,
    });

    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      if (result.code === "deletable-ratio") {
        process.stderr.write(
          "Re-run with --allow-high-ratio only if you have confirmed that the database and the folder are the right ones.\n",
        );
      }
      return 1;
    }

    printSummary(options, assets.length, result);

    const logPath = deleteLogPath(options.reportPath);
    await writeReport(options, assets.length, result, logPath);

    if (!options.confirm) {
      process.stdout.write(
        "Dry run: nothing was deleted. Re-run with --confirm to delete the assets above.\n",
      );
      return 0;
    }

    const outcomes = await deleteInBatches(provider, result.deletable, logPath);
    return reportDeletions(outcomes);
  } finally {
    await database.close();
  }
}

function buildProvider(folder: string): ImageProvider {
  try {
    // Building the provider also configures the Cloudinary SDK globally, which
    // is what the Admin API listing below uses.
    return createCloudinaryProvider(
      cloudinaryConfigFromEnv(process.env, { defaults: { folder } }),
    );
  } catch (error) {
    throw new SweepFailure(
      `Could not start the sweep: ${describeError(error)}. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.`,
    );
  }
}

async function openDatabase(): Promise<DatabaseKeys> {
  let prisma: typeof import("@/lib/db").prisma;

  try {
    ({ prisma } = await import("@/lib/db"));
  } catch (error) {
    throw new SweepFailure(
      `Could not open the database: ${describeError(error)}. DATABASE_URL must be set.`,
    );
  }

  try {
    const cars = await prisma.car.findMany({ select: { images: true } });
    const uploads = await prisma.imageUpload.findMany({
      select: { key: true },
    });

    return {
      referenced: new Set(cars.flatMap((car) => car.images)),
      recorded: new Set(uploads.map((upload) => upload.key)),
      close: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw new SweepFailure(
      `Could not read Car.images and ImageUpload: ${describeError(error)}`,
    );
  }
}

async function listAssets(folder: string): Promise<ListedAsset[]> {
  const api = cloudinary.api as unknown as {
    resources(
      options: Record<string, unknown>,
    ): Promise<CloudinaryResourcesPage>;
  };

  const prefix = `${folder}/`;
  const assets: ListedAsset[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  try {
    // Every page, until Cloudinary stops handing out a cursor: a silent cap
    // would leave assets unclassified and make the counts lie.
    for (;;) {
      const page = await api.resources({
        type: "upload",
        prefix,
        max_results: LIST_PAGE_SIZE,
        ...(cursor === undefined ? {} : { next_cursor: cursor }),
      });

      for (const resource of page.resources ?? []) {
        assets.push({
          publicId: resource.public_id,
          createdAt: resource.created_at,
          bytes: resource.bytes,
        });
      }

      const next = page.next_cursor;
      if (next === undefined || next === "") break;

      if (seenCursors.has(next)) {
        throw new SweepFailure(
          `Cloudinary repeated the pagination cursor ${next} for "${prefix}"; stopping instead of looping.`,
        );
      }

      seenCursors.add(next);
      cursor = next;
    }
  } catch (error) {
    if (error instanceof SweepFailure) throw error;
    throw new SweepFailure(
      `Could not list the assets in "${prefix}": ${describeError(error)}`,
    );
  }

  return assets;
}

function printSummary(
  options: SweepOptions,
  assetsFound: number,
  result: OrphanSweepOk,
): void {
  const lines = [
    `Folder: ${options.folder}/ (${assetsFound} assets found)`,
    `Older than: ${options.olderThanDays} whole days`,
    `Skipped — already referenced by a car: ${result.skipped.alreadyReferenced}`,
    `Skipped — already recorded in ImageUpload: ${result.skipped.alreadyRecorded}`,
    `Skipped — too new: ${result.skipped.tooNew}`,
    `${options.confirm ? "Deleting" : "Would delete"}: ${result.deletable.length} assets (${(
      result.ratio * 100
    ).toFixed(1)}%), ${formatBytes(result.totalBytes)}`,
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

async function writeReport(
  options: SweepOptions,
  assetsFound: number,
  result: OrphanSweepOk,
  logPath: string,
): Promise<void> {
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.confirm ? "confirm" : "dry-run",
    folder: options.folder,
    olderThanDays: options.olderThanDays,
    allowHighRatio: options.allowHighRatio,
    maxDeletableRatioPercent: MAX_DELETABLE_RATIO_PERCENT,
    assetsFound,
    counts: {
      delete: result.deletable.length,
      skipAlreadyReferenced: result.skipped.alreadyReferenced,
      skipAlreadyRecorded: result.skipped.alreadyRecorded,
      skipTooNew: result.skipped.tooNew,
    },
    deletableRatio: result.ratio,
    totalBytes: result.totalBytes,
    deleteLog: logPath,
    // Every listed asset, so the decision can be reconstructed without the
    // Cloudinary listing that produced it.
    assets: result.decisions,
  };

  // Before any deletion, in both modes: a failed delete must still leave the
  // selection on disk.
  await writeFile(
    options.reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    `Report written to ${path.resolve(options.reportPath)}\n`,
  );
}

async function deleteInBatches(
  provider: ImageProvider,
  deletable: readonly SweepAssetDecision[],
  logPath: string,
): Promise<readonly DeleteOutcome[]> {
  const batches: SweepAssetDecision[][] = [];
  for (let index = 0; index < deletable.length; index += DELETE_BATCH_SIZE) {
    batches.push(deletable.slice(index, index + DELETE_BATCH_SIZE));
  }

  const outcomes: DeleteOutcome[] = [];

  for (const [index, batch] of batches.entries()) {
    const batchOutcomes = await deleteBatch(provider, batch);
    outcomes.push(...batchOutcomes);

    // Appended per batch, not once at the end: a run killed halfway still leaves
    // a log of everything it attempted.
    await appendOutcomes(logPath, batchOutcomes);

    const failed = batchOutcomes.filter(
      (outcome) => outcome.outcome === "failed",
    ).length;

    process.stdout.write(
      `Batch ${index + 1}/${batches.length}: ${batch.length} keys → ${
        batch.length - failed
      } deleted, ${failed} failed\n`,
    );
  }

  return outcomes;
}

async function appendOutcomes(
  logPath: string,
  outcomes: readonly DeleteOutcome[],
): Promise<void> {
  const at = new Date().toISOString();
  await appendFile(
    logPath,
    outcomes
      .map((outcome) => `${JSON.stringify({ at, ...outcome })}\n`)
      .join(""),
    "utf8",
  );
}

/**
 * `deleteMany` answers with counts only, so a failure has no name attached. When
 * a batch reports any failure the keys are retried one by one: Cloudinary answers
 * "not found" for an asset that is already gone, which the provider maps to
 * success, so the retry reports the real final state per key instead of guessing.
 */
async function deleteBatch(
  provider: ImageProvider,
  batch: readonly SweepAssetDecision[],
): Promise<readonly DeleteOutcome[]> {
  const keys = batch.map((entry) => entry.key);

  let failed: number;
  try {
    const result = await provider.deleteMany([...keys]);
    failed = result.failed;
  } catch (error) {
    return batch.map((entry) => ({
      publicId: entry.publicId,
      key: entry.key,
      outcome: "failed" as const,
      error: describeError(error),
    }));
  }

  if (failed === 0) {
    return batch.map((entry) => ({
      publicId: entry.publicId,
      key: entry.key,
      outcome: "deleted" as const,
    }));
  }

  const outcomes: DeleteOutcome[] = [];

  for (const entry of batch) {
    const result = await provider.delete(entry.key);
    outcomes.push(
      result.success
        ? { publicId: entry.publicId, key: entry.key, outcome: "deleted" }
        : {
            publicId: entry.publicId,
            key: entry.key,
            outcome: "failed",
            error: result.error ?? "delete failed",
          },
    );
  }

  return outcomes;
}

function reportDeletions(outcomes: readonly DeleteOutcome[]): number {
  const failures = outcomes.filter((outcome) => outcome.outcome === "failed");

  process.stdout.write(
    `Deleted ${outcomes.length - failures.length} of ${outcomes.length} assets.\n`,
  );

  if (failures.length === 0) return 0;

  process.stderr.write(`${failures.length} deletions failed:\n`);
  for (const failure of failures) {
    process.stderr.write(
      `  ${failure.key}: ${failure.error ?? "delete failed"}\n`,
    );
  }

  return 1;
}

/** `<dir>/<name>.delete-log.jsonl`, keeping the report's name recognisable. */
function deleteLogPath(reportPath: string): string {
  const parsed = path.parse(reportPath);
  return path.join(parsed.dir, `${parsed.name}.delete-log.jsonl`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(1)} ${units[unit]}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
