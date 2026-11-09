import "dotenv/config";

import {
  DEFAULT_DRAIN_LIMIT,
  DEFAULT_STALE_AFTER_MS,
  drain,
  listClaimable,
  listStale,
  recoverStale,
} from "@/lib/jobs/queue";
import type { JobRegistry, JobRow, JobStore } from "@/lib/jobs/types";

/**
 * Drains the durable job queue once.
 *
 * A thin shell on purpose. Claiming, retrying, dead-lettering and stale-lock
 * recovery all live in `src/lib/jobs/queue.ts` where vitest reaches them with a
 * fake client; this file only parses flags, opens the database, prints and
 * (with `--confirm`) runs one pass.
 *
 * Dry run is the default, like `rotate:tokens` and `sweep:orphans`: a queue is
 * shared state, so listing what would be claimed must be the easy, safe action.
 *
 * Wiring this to a schedule is a deployment decision and is deliberately NOT
 * part of this file: there is no cron route and `vercel.json` has no cron
 * entry. A drainer that runs on a timer ships after the handlers it calls exist
 * and after a human chooses where it runs.
 */

const USAGE = `Usage: pnpm drain:jobs [options]

Runs one pass over the job queue. Dry run by default — no job is claimed and
nothing is written without --confirm.

Options:
  --limit=<n>               Claim at most <n> jobs. Default: ${DEFAULT_DRAIN_LIMIT}.
  --dry-run                 Only list the jobs a pass would claim (the default).
  --confirm                 Actually drain: recover stale locks, then run up to
                            --limit jobs.
  --help                    Print this message and exit 0.

A lock older than ${DEFAULT_STALE_AFTER_MS / 60_000} minutes is stale: a drainer died holding it, so the
pass returns the job to the queue and counts that attempt.

No handlers are registered yet. Until T5–T8 register the MercadoLibre ones, a
job whose kind has no handler is marked FAILED with a message saying so, and
enqueueing the same key again revives it.

Exit codes: 0 on success, 1 when the pass failed or left a job DEAD/FAILED,
2 on a usage error.
`;

interface Options {
  readonly limit: number;
  readonly confirm: boolean;
}

type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "options"; readonly options: Options }
  | { readonly kind: "error"; readonly message: string };

/** An expected failure: printed as one readable line, without a stack trace. */
class DrainFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrainFailure";
  }
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let limit = DEFAULT_DRAIN_LIMIT;
  let confirm = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { kind: "help" };

    if (arg === "--confirm") {
      confirm = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const raw = arg.slice("--limit=".length);
      const parsed = Number(raw);

      if (raw === "" || !Number.isInteger(parsed) || parsed < 0) {
        return {
          kind: "error",
          message: `--limit must be a whole number of jobs, got "${raw}"`,
        };
      }

      limit = parsed;
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    }

    return { kind: "error", message: `Unexpected argument: ${arg}` };
  }

  if (confirm && dryRun) {
    return {
      kind: "error",
      message:
        "--dry-run and --confirm contradict each other: --confirm is the real drain.",
    };
  }

  return { kind: "options", options: { limit, confirm } };
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
    if (error instanceof DrainFailure) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }

    process.stderr.write(
      `The drain failed unexpectedly: ${describeError(error)}\n`,
    );
    return 1;
  }
}

/**
 * The handlers this drainer knows.
 *
 * Empty until T5–T8 land the MercadoLibre operations. It is a `Map` and not an
 * object so a row whose `kind` happens to be `constructor` cannot resolve to
 * something inherited.
 */
function loadRegistry(): JobRegistry {
  return new Map();
}

async function run(options: Options): Promise<number> {
  // Imported lazily: `@/lib/db` builds a Prisma client while it is evaluated,
  // and `--help` must work with no environment at all.
  const { prisma } = await openDatabase();

  /**
   * The queue's store is the `Job` delegate of the real client. The cast is
   * confined to this line, and it is a mutability/JSON mismatch rather than a
   * behavioural one: Prisma's generated argument types demand mutable filter
   * arrays (`string[]`, not `readonly string[]`) and `InputJsonValue` for
   * `payload`, while the engine declares readonly structures and an opaque
   * payload. Every method called here — upsert, findFirst, findMany,
   * findUnique, updateMany — exists with this shape.
   */
  const store = prisma as unknown as JobStore;

  try {
    const now = new Date();
    const registry = loadRegistry();
    const stale = await listStale(store, { now });

    if (!options.confirm) {
      const claimable = await listClaimable(store, {
        now,
        limit: options.limit,
      });
      printDryRun(claimable, stale, registry, options.limit);
      return 0;
    }

    if (stale.length > 0) {
      const recovered = await recoverStale(store, { now });

      process.stdout.write(
        `Recovered ${recovered.length} stale lock(s); a job that exhausts its attempts that way is marked DEAD.\n`,
      );

      for (const job of recovered) {
        process.stdout.write(
          `  ${job.id}  ${job.kind}  -> ${job.status}  attempts=${job.attempts}\n`,
        );
      }
    }

    const summary = await drain({
      store,
      registry,
      // Identifies the process that owns a lock, so a recovered row says who
      // never came back.
      workerId: `drain-jobs:${process.pid}`,
      now: () => new Date(),
      limit: options.limit,
    });

    printSummary(summary);

    return summary.dead + summary.failed > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

function printDryRun(
  claimable: readonly JobRow[],
  stale: readonly JobRow[],
  registry: JobRegistry,
  limit: number,
): void {
  const lines = [
    "Dry run: nothing is claimed and nothing is written.",
    `Claimable now: ${claimable.length} (limit ${limit})`,
    ...claimable.map(
      (job) =>
        `  ${job.id}  ${job.kind}  runAt=${job.runAt.toISOString()}  attempts=${job.attempts}/${job.maxAttempts}  key=${job.idempotencyKey}`,
    ),
    `Stale locks that would be recovered: ${stale.length}`,
    ...stale.map(
      (job) =>
        `  ${job.id}  ${job.kind}  lockedBy=${job.lockedBy ?? "unknown"}  lockedAt=${(job.lockedAt ?? job.runAt).toISOString()}  attempts=${job.attempts}/${job.maxAttempts}`,
    ),
    `Handlers registered: ${registry.size}`,
    "Re-run with --confirm to drain.",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

function printSummary(summary: {
  readonly claimed: number;
  readonly succeeded: number;
  readonly rateLimited: number;
  readonly retried: number;
  readonly dead: number;
  readonly failed: number;
  readonly outcomes: readonly {
    readonly jobId: string;
    readonly kind: string;
    readonly outcome: string;
    readonly attempts: number;
    readonly error: string | null;
  }[];
}): void {
  process.stdout.write(
    `Claimed ${summary.claimed} job(s): ${summary.succeeded} succeeded, ${summary.rateLimited} rate-limited, ${summary.retried} retried, ${summary.dead} dead, ${summary.failed} failed.\n`,
  );

  for (const outcome of summary.outcomes) {
    const suffix = outcome.error === null ? "" : `  ${outcome.error}`;
    process.stdout.write(
      `  ${outcome.jobId}  ${outcome.kind}  ${outcome.outcome}  attempts=${outcome.attempts}${suffix}\n`,
    );
  }

  if (summary.dead + summary.failed > 0) {
    process.stderr.write(
      `${summary.dead + summary.failed} job(s) need a human: DEAD means the retries ran out, FAILED means the drainer has no handler for that kind.\n`,
    );
  }
}

async function openDatabase(): Promise<typeof import("@/lib/db")> {
  try {
    return await import("@/lib/db");
  } catch (error) {
    throw new DrainFailure(
      `Could not open the database: ${describeError(error)}. DATABASE_URL must be set.`,
    );
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`The drain failed: ${describeError(error)}\n`);
    process.exitCode = 1;
  });
