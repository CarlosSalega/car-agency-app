import path from "node:path";

import {
  applySync,
  inspectSync,
  pushDeployment,
} from "@/lib/deploy/sync-deployment";
import type {
  AppliedSync,
  SyncInspection,
  SyncPlan,
  SyncRefusal,
} from "@/lib/deploy/sync-deployment";

/**
 * Ship this product over a deployment repository, keeping the deployment's own
 * surface: its client package, its three seam files and everything under
 * `public/`.
 *
 * A thin shell, like `sweep:orphans`, `publications` and `drain:jobs`: every
 * rule — which paths are preserved, both dirtiness guards, the missing-origin
 * guard — lives in `src/lib/deploy/sync-deployment.ts`, where vitest reaches it
 * with two temporary repositories. This file parses flags, prints, and pushes
 * only when told to.
 *
 * Dry run is the default because a sync rewrites another repository's tree and
 * then publishes it. `--confirm` creates one commit on top of the deployment's
 * HEAD; `--push=false` keeps that commit local, which is how a maintainer runs
 * the deployment's own build and reads the diff before anything leaves the
 * machine. Nothing here ever forces.
 */

const USAGE = `Usage: pnpm sync:deployment --to=<path> [options]

Copies this product's tree over a deployment repository, then restores the paths
that deployment owns from its own HEAD: every client package under src/site/ (a
top-level directory other than __tests__ and demo), src/site/registry.ts,
src/site/theme.css, src/site/seed.ts, and everything under public/.

Dry run by default: prints the plan and changes nothing. --confirm creates one
commit on top of the deployment's HEAD and pushes it with a normal push. It
never force-pushes and never rewrites a commit.

Options:
  --to=<path>       The deployment repository. Required.
  --from=<path>     The product repository. Default: the current directory,
                    which pnpm sets to this checkout when it runs the script.
  --confirm         Create the commit and, unless --push=false, push it.
  --push=false      Commit locally without pushing. Use it to run the
                    deployment's build and read the diff before publishing;
                    the commit then waits for a plain \`git push\`.
  --help            Print this message and exit 0.

The sync refuses — exit 1, naming the guard — when either repository has
uncommitted changes, when either path is not the root of a git repository, when
the deployment has no origin remote, is on a detached HEAD, or has no commits.

Exit codes: 0 on success, 1 when a guard refused or git failed, 2 on a usage
error.
`;

interface SyncOptions {
  readonly to: string;
  readonly from: string;
  readonly confirm: boolean;
  readonly push: boolean;
}

type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "options"; readonly options: SyncOptions }
  | { readonly kind: "error"; readonly message: string };

/** How many paths a section prints before it summarises the rest. */
const PRINTED_PATHS = 40;

function parseArgs(argv: readonly string[]): ParsedArgs {
  let to: string | null = null;
  let from = process.cwd();
  let confirm = false;
  let push = true;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { kind: "help" };
    if (arg === "--confirm") {
      confirm = true;
      continue;
    }
    if (arg === "--no-push") {
      push = false;
      continue;
    }

    const separator = arg.indexOf("=");
    const name = separator === -1 ? arg : arg.slice(0, separator);
    const value = separator === -1 ? undefined : arg.slice(separator + 1);

    if (name === "--to") {
      if (value === undefined || value.trim() === "") {
        return {
          kind: "error",
          message: "--to needs the path of the deployment repository.",
        };
      }
      to = path.resolve(value);
      continue;
    }

    if (name === "--from") {
      if (value === undefined || value.trim() === "") {
        return {
          kind: "error",
          message: "--from needs the path of the product repository.",
        };
      }
      from = path.resolve(value);
      continue;
    }

    if (name === "--push") {
      if (value !== "true" && value !== "false") {
        return {
          kind: "error",
          message: `--push takes true or false, e.g. --push=false (got ${
            value ?? "nothing"
          }).`,
        };
      }
      push = value === "true";
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    }

    return { kind: "error", message: `Unexpected argument: ${arg}` };
  }

  if (to === null) {
    return {
      kind: "error",
      message:
        "Missing --to: the sync needs the deployment repository it should update.",
    };
  }

  return { kind: "options", options: { to, from, confirm, push } };
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

  const options = parsed.options;
  const input = { productPath: options.from, deploymentPath: options.to };

  try {
    if (!options.confirm) {
      const inspection = await inspectSync(input);
      if (!inspection.ok) return reportRefusal(inspection);

      printInspection(inspection);
      printPlan(inspection.plan, "would");
      process.stdout.write(
        "\nDry run: nothing was written. Re-run with --confirm to create the commit" +
          (options.push
            ? " and push it.\n"
            : ", and with --push=false to keep it local.\n"),
      );
      return 0;
    }

    const applied = await applySync(input);
    if (!applied.ok) return reportRefusal(applied);

    printApplied(applied);

    if (applied.commit === null) {
      process.stdout.write(
        `\nNothing to commit: the deployment already matches ${applied.productCommit.slice(
          0,
          7,
        )} on every product-owned path. Nothing was pushed.\n`,
      );
      return 0;
    }

    if (!options.push) {
      process.stdout.write(
        `\nNot pushed (--push=false). The commit is local; publish it with:\n  git -C ${applied.deploymentPath} push origin ${applied.branch}\n`,
      );
      return 0;
    }

    const pushed = await pushDeployment({
      deploymentPath: applied.deploymentPath,
      branch: applied.branch,
    });
    if (!pushed.ok) return reportRefusal(pushed);

    process.stdout.write(
      `\nPushed ${applied.commit.sha.slice(0, 7)} to origin/${applied.branch}.\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(
      `The sync failed unexpectedly: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return 1;
  }
}

function reportRefusal(refusal: SyncRefusal): number {
  process.stderr.write(
    `Refusing (guard: ${refusal.code}): ${refusal.reason}\n`,
  );
  return 1;
}

function printInspection(inspection: SyncInspection): void {
  process.stdout.write(
    [
      `Product:    ${inspection.productPath} (${shortCommit(inspection.productCommit)})`,
      `Deployment: ${inspection.deploymentPath} (${inspection.branch}, ${shortCommit(
        inspection.deploymentCommit,
      )}, origin ${inspection.origin})`,
      "",
    ].join("\n"),
  );
}

function printApplied(applied: AppliedSync): void {
  process.stdout.write(
    [
      `Product:    ${applied.productPath} (${shortCommit(applied.productCommit)})`,
      `Deployment: ${applied.deploymentPath} (${applied.branch}, from ${shortCommit(
        applied.baseCommit,
      )})`,
      "",
    ].join("\n"),
  );

  printSection("Added from the product", applied.added);
  printSection("Changed from the product", applied.modified);
  printSection("Removed", applied.deleted);
  printSection("Preserved from the deployment", applied.preserved);

  printNotes(applied.plan);

  if (applied.commit !== null) {
    process.stdout.write(
      [
        "",
        `Commit created: ${applied.commit.sha.slice(0, 7)}`,
        `  parent: ${applied.commit.parent === null ? "(root)" : applied.commit.parent}`,
        `  message: ${applied.commit.message.split("\n")[0]}`,
        "",
      ].join("\n"),
    );
  }
}

function printPlan(plan: SyncPlan, verb: string): void {
  printSection(`Paths that ${verb} be added`, plan.added);
  printSection(
    `Paths that ${verb} be changed from the product`,
    plan.fromProduct,
  );
  printSection(`Paths that ${verb} be removed`, plan.removed);
  printSection("Paths preserved from the deployment", plan.preserved);
  printNotes(plan);
}

/**
 * The notes a maintainer needs before confirming: a deployment with no extra
 * client package is a legitimate state, and one with no seed seam yet is the
 * state this repository's own deployment is in.
 */
function printNotes(plan: SyncPlan): void {
  const lines: string[] = [""];

  lines.push(
    plan.clientPackages.length === 0
      ? "Client packages preserved: none — this deployment ships only the product's demo client."
      : `Client packages preserved: ${plan.clientPackages.join(", ")}`,
  );

  for (const seam of plan.missingSeams) {
    lines.push(
      `Missing preserved path: ${seam} — this deployment has none yet. The product's copy is not used, because that would point the deployment at the demo's data.`,
    );
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function printSection(label: string, paths: readonly string[]): void {
  const lines = [
    `${label}: ${paths.length} ${paths.length === 1 ? "path" : "paths"}`,
  ];

  for (const entry of paths.slice(0, PRINTED_PATHS)) {
    lines.push(`  ${entry}`);
  }

  if (paths.length > PRINTED_PATHS) {
    lines.push(`  … and ${paths.length - PRINTED_PATHS} more`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function shortCommit(sha: string): string {
  return sha.slice(0, 7);
}

void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
