/**
 * The sync that ships this product over a deployment repository.
 *
 * One deployment per dealership, and the deployment is its own git repository:
 * it carries the client package, its seed, its branded assets and its photos,
 * while everything else under the tree is the product's. Copying the product's
 * tree over the deployment used to be safe only because the product still
 * carried the client; it is not safe now. So the sync is two steps in one
 * commit: take the product's tree, then restore the paths the deployment owns
 * from its own `HEAD`.
 *
 * **The preserved surface is derived, never configured.** Every top-level
 * directory under `src/site/` other than `__tests__` and `demo` is a client
 * package; the three seam files and `public/` are seams too. A list of names in
 * this file would be a list of clients, and the product must not know which
 * clients exist — it has to work for a deployment that ships one, none, or a
 * name nobody here has heard of.
 *
 * The split with `scripts/sync-deployment.ts` is the house pattern: every rule
 * lives here, where vitest reaches it with two temporary repositories; the
 * script only parses flags, prints and exits. `applySync` never pushes — a push
 * is the CLI's `--confirm` — and it never forces and never rewrites: it creates
 * one ordinary commit on top of the deployment's `HEAD`, and the product is only
 * ever read.
 */

import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Where the client packages live, relative to a repository root. */
export const SITE_DIRECTORY = "src/site";

/**
 * Directories under `src/site/` that are *not* client packages.
 *
 * `__tests__` is the product's own guard, and `demo` is the client the product
 * ships so a fresh clone builds — both belong to the product and must keep
 * receiving updates. Everything else under `src/site/` is a deployment's.
 */
export const SITE_DIRECTORY_EXCLUSIONS: ReadonlySet<string> = new Set([
  "__tests__",
  "demo",
]);

/**
 * The seam files a deployment owns, verbatim.
 *
 * `registry.ts` is the slug → package map that makes a client selectable,
 * `theme.css` is the static `@import` of the brand tokens, and `seed.ts` is the
 * pointer to the catalogue. A whole-tree copy would point all three back at the
 * demo client, which is the defect this file exists to prevent.
 */
export const SEAM_FILES: readonly string[] = [
  `${SITE_DIRECTORY}/registry.ts`,
  `${SITE_DIRECTORY}/theme.css`,
  `${SITE_DIRECTORY}/seed.ts`,
];

/** Everything under here belongs to the deployment: logo, hero, photos. */
export const PUBLIC_DIRECTORY = "public";

/**
 * Directories a sync never removes even when they end up empty.
 *
 * `rmdir` refuses a non-empty directory anyway, so this is a second lock: the
 * sync prunes only the directories its own deletions emptied.
 */
const NEVER_PRUNED: ReadonlySet<string> = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
]);

/** `git` output is a whole tree here; the default 1 MiB buffer is not enough. */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

export interface PlanSyncInput {
  /** Every file path in the product's tree, relative to its root. */
  readonly productTree: readonly string[];
  /** Every file path in the deployment's tree, relative to its root. */
  readonly deploymentTree: readonly string[];
}

/**
 * What a sync would do, decided from two path lists alone.
 *
 * `fromProduct` is "taken from the product": the product owns the path and the
 * deployment already has it, so the sync overwrites it. `added` and `removed`
 * are the tree differences. `preserved` comes from the deployment and is
 * restored from its `HEAD`, so it never appears in the other three.
 */
export interface SyncPlan {
  readonly preserved: readonly string[];
  readonly fromProduct: readonly string[];
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Client packages under `src/site/`, derived from the deployment's tree. */
  readonly clientPackages: readonly string[];
  /**
   * Preserved paths the deployment does not have *yet*: the three seam files,
   * and `public/` when it carries no assets at all.
   *
   * Reported, never repaired. A deployment synced before the seed moved behind
   * the seam has no `src/site/seed.ts`, and writing the product's demo pointer
   * there would silently serve the demo catalogue — so the sync says so and
   * leaves the decision to the maintainer.
   */
  readonly missingSeams: readonly string[];
}

/**
 * Whether a path belongs to the deployment.
 *
 * Derivation, not configuration: the caller passes a path, this answers from the
 * shape of the tree. The client-package check requires a segment *after* the
 * directory name (`src/site/<client>/...`), so `src/site/active.ts` and friends
 * stay product-owned.
 */
export function isPreservedPath(entry: string): boolean {
  const candidate = normalizePath(entry);

  if (
    candidate === PUBLIC_DIRECTORY ||
    candidate.startsWith(`${PUBLIC_DIRECTORY}/`)
  ) {
    return true;
  }

  if (SEAM_FILES.includes(candidate)) return true;

  const segments = candidate.split("/");
  if (segments.length < 4) return false;
  if (segments[0] !== "src" || segments[1] !== "site") return false;

  return !SITE_DIRECTORY_EXCLUSIONS.has(segments[2]);
}

/**
 * The plan for one sync: which paths stay, which arrive, which leave.
 *
 * No I/O on purpose, so the rules are pinned by tests that never touch git and
 * so the shell that runs the sync cannot drift from them.
 */
export function planSync(input: PlanSyncInput): SyncPlan {
  const productTree = normalizeTree(input.productTree);
  const deploymentTree = normalizeTree(input.deploymentTree);

  const productPaths = new Set(productTree);
  const deploymentPaths = new Set(deploymentTree);

  const preserved = deploymentTree.filter(isPreservedPath);
  const preservedPaths = new Set(preserved);

  const productOwned = productTree.filter((entry) => !isPreservedPath(entry));

  const fromProduct = productOwned.filter((entry) =>
    deploymentPaths.has(entry),
  );
  const added = productOwned.filter((entry) => !deploymentPaths.has(entry));
  const removed = deploymentTree.filter(
    (entry) => !preservedPaths.has(entry) && !productPaths.has(entry),
  );

  const clientPackages = [
    ...new Set(
      deploymentTree
        .map(clientPackageOf)
        .filter((name): name is string => name !== null),
    ),
  ].sort();

  const missingSeams = SEAM_FILES.filter((seam) => !deploymentPaths.has(seam));
  const hasPublic = deploymentTree.some(
    (entry) =>
      entry === PUBLIC_DIRECTORY || entry.startsWith(`${PUBLIC_DIRECTORY}/`),
  );
  if (!hasPublic) missingSeams.push(PUBLIC_DIRECTORY);

  return {
    preserved,
    fromProduct,
    added,
    removed,
    clientPackages,
    missingSeams,
  };
}

export type SyncRefusalCode =
  | "not-a-directory"
  | "not-a-repository-root"
  | "dirty-working-tree"
  | "missing-origin"
  | "detached-head"
  | "no-commits"
  | "inconsistent-plan"
  | "preserved-surface-modified"
  | "git-failed";

/**
 * A refusal, not a crash: every guard answers with the code that fired so the
 * CLI can name it and a maintainer can tell a dirty tree from a missing remote.
 */
export interface SyncRefusal {
  readonly ok: false;
  readonly code: SyncRefusalCode;
  readonly reason: string;
}

export interface InspectSyncInput {
  /** The product's repository root. */
  readonly productPath: string;
  /** The deployment's repository root. */
  readonly deploymentPath: string;
}

/** Everything a sync needs to know before it writes anything. */
export interface SyncInspection {
  readonly ok: true;
  /** Real paths, so the printed report is the one git acted on. */
  readonly productPath: string;
  readonly deploymentPath: string;
  readonly productCommit: string;
  readonly deploymentCommit: string;
  readonly branch: string;
  readonly origin: string;
  readonly plan: SyncPlan;
}

export interface SyncCommit {
  readonly sha: string;
  /** The commit this one was created on top of; `null` only for a root commit. */
  readonly parent: string | null;
  readonly message: string;
  readonly productCommit: string;
}

export interface AppliedSync {
  readonly ok: true;
  readonly productPath: string;
  readonly deploymentPath: string;
  readonly productCommit: string;
  /** The deployment's `HEAD` before the sync. */
  readonly baseCommit: string;
  readonly branch: string;
  readonly origin: string;
  readonly plan: SyncPlan;
  /** Observed from the staged tree, not predicted from the plan. */
  readonly added: readonly string[];
  readonly modified: readonly string[];
  readonly deleted: readonly string[];
  readonly preserved: readonly string[];
  /** `null` when the deployment already matched the product. */
  readonly commit: SyncCommit | null;
}

/**
 * The read-only half of a sync: run every guard and compute the plan.
 *
 * The CLI's dry run is exactly this, so a refusal shows up before a maintainer
 * decides to confirm and not after.
 */
export async function inspectSync(
  input: InspectSyncInput,
): Promise<SyncInspection | SyncRefusal> {
  const productRoot = await repositoryRoot(input.productPath, "product");
  if (!productRoot.ok) return productRoot;

  const deploymentRoot = await repositoryRoot(
    input.deploymentPath,
    "deployment",
  );
  if (!deploymentRoot.ok) return deploymentRoot;

  const productDirty = await dirtyPaths(productRoot.root);
  if (productDirty.length > 0) {
    return refuse(
      "dirty-working-tree",
      `The product repository ${productRoot.root} has uncommitted changes (${summarise(
        productDirty,
      )}). The sync ships the product's HEAD, so commit or stash them first — otherwise the deployment would receive a tree that exists nowhere in history.`,
    );
  }

  const deploymentDirty = await dirtyPaths(deploymentRoot.root);
  if (deploymentDirty.length > 0) {
    return refuse(
      "dirty-working-tree",
      `The deployment repository ${deploymentRoot.root} has uncommitted changes (${summarise(
        deploymentDirty,
      )}). The sync replaces the product-owned part of that tree; commit, stash or revert first, so nothing of the deployment's own work can be lost.`,
    );
  }

  const deploymentCommit = await resolveCommit(deploymentRoot.root);
  if (deploymentCommit === null) {
    return refuse(
      "no-commits",
      `The deployment repository ${deploymentRoot.root} has no commits. The sync creates one commit on top of its HEAD, and restoring the preserved paths needs a HEAD to restore them from.`,
    );
  }

  const productCommit = await resolveCommit(productRoot.root);
  if (productCommit === null) {
    return refuse(
      "no-commits",
      `The product repository ${productRoot.root} has no commits, so there is no tree to ship.`,
    );
  }

  const branch = await currentBranch(deploymentRoot.root);
  if (branch === null) {
    return refuse(
      "detached-head",
      `The deployment repository ${deploymentRoot.root} is on a detached HEAD. A commit there would belong to no branch and could not be pushed without a name, so check out the branch this deployment is served from.`,
    );
  }

  const origin = await gitText(
    ["remote", "get-url", "origin"],
    deploymentRoot.root,
  );
  if (origin === null) {
    return refuse(
      "missing-origin",
      `The deployment repository ${deploymentRoot.root} has no "origin" remote. The sync refuses before committing: a deployment whose origin is missing is either not the repository you think it is, or one whose commit nobody could fetch.`,
    );
  }

  const productTree = await listTree(productRoot.root);
  const deploymentTree = await listTree(deploymentRoot.root);

  return {
    ok: true,
    productPath: productRoot.root,
    deploymentPath: deploymentRoot.root,
    productCommit,
    deploymentCommit,
    branch,
    origin,
    plan: planSync({ productTree, deploymentTree }),
  };
}

/**
 * Copy the product's tree over the deployment, restore the deployment's surface
 * from its `HEAD`, and create one commit on top of it.
 *
 * Never pushes. `pushDeployment` is separate so the commit and the publication
 * are two decisions a maintainer makes on purpose.
 */
export async function applySync(
  input: InspectSyncInput,
): Promise<AppliedSync | SyncRefusal> {
  const inspection = await inspectSync(input);
  if (!inspection.ok) return inspection;

  const { plan } = inspection;

  // Pure, and asserted before a single byte is written: a path the deployment
  // owns must never be one the sync adds, overwrites or removes.
  const claimed = new Set([
    ...plan.added,
    ...plan.fromProduct,
    ...plan.removed,
  ]);
  const overlap = plan.preserved.filter((entry) => claimed.has(entry));
  if (overlap.length > 0) {
    return refuse(
      "inconsistent-plan",
      `The plan would write ${summarise(overlap)}, which the deployment owns. Nothing was written; this is a bug in the sync.`,
    );
  }

  const specs = preservedPathspecs(plan);
  const scratch = await mkdtemp(path.join(tmpdir(), "sync-deployment-"));

  try {
    // The product's HEAD, exported through its index. `inspectSync` refuses a
    // dirty tree, so the index is the HEAD tree: what ships is what the product
    // committed, never whatever happens to sit in the working directory.
    const tree = path.join(scratch, "product");
    await mkdir(tree, { recursive: true });
    const exported = await runGit(
      ["checkout-index", "--all", `--prefix=${tree}/`],
      inspection.productPath,
    );
    if (exported.code !== 0) {
      throw new SyncFailure(
        `Could not export the product's tree from HEAD: ${describeGit(exported)}`,
      );
    }

    for (const relative of plan.removed) {
      await removeIfPresent(path.join(inspection.deploymentPath, relative));
    }
    await pruneEmptiedDirectories(
      inspection.deploymentPath,
      plan.removed,
      specs,
    );

    for (const relative of [...plan.added, ...plan.fromProduct]) {
      await copyInto(
        path.join(tree, relative),
        path.join(inspection.deploymentPath, relative),
        relative,
      );
    }

    // "The product's tree, then restore the preserved paths from the
    // deployment's HEAD." The copy above already skips them; restoring them
    // explicitly is what makes the guarantee true even if that ever changes,
    // and it repairs a deployment whose preserved files were touched outside
    // git's knowledge of its own tree.
    if (specs.length > 0) {
      const restored = await runGit(
        ["checkout", "HEAD", "--", ...specs],
        inspection.deploymentPath,
      );
      if (restored.code !== 0) {
        throw new SyncFailure(
          `Could not restore the deployment's preserved paths from HEAD: ${describeGit(restored)}`,
        );
      }
    }

    const staged = await runGit(["add", "--all"], inspection.deploymentPath);
    if (staged.code !== 0) {
      throw new SyncFailure(
        `Could not stage the synced tree: ${describeGit(staged)}`,
      );
    }

    // The one invariant this whole module exists for. Unreachable by
    // construction, checked anyway: a sync that edits the deployment's surface
    // is the failure that costs a dealership its photos, and a silent one is
    // worse than a refusal.
    if (specs.length > 0) {
      const leak = await runGit(
        ["diff", "--cached", "--name-only", "-z", "--", ...specs],
        inspection.deploymentPath,
      );
      const leaked = splitNul(leak.stdout);
      if (leaked.length > 0) {
        await runGit(
          ["checkout", "HEAD", "--", ...specs],
          inspection.deploymentPath,
        );
        return refuse(
          "preserved-surface-modified",
          `The staged tree changed ${summarise(
            leaked,
          )}, which the deployment owns. Those files were restored from HEAD and no commit was created; check the deployment's working tree before running the sync again.`,
        );
      }
    }

    const diff = await runGit(
      ["diff", "--cached", "--name-status", "-z", "--no-renames"],
      inspection.deploymentPath,
    );
    if (diff.code !== 0) {
      throw new SyncFailure(
        `Could not read the staged changes: ${describeGit(diff)}`,
      );
    }

    const changes = parseNameStatus(diff.stdout);
    const unchanged: AppliedSync = {
      ok: true,
      productPath: inspection.productPath,
      deploymentPath: inspection.deploymentPath,
      productCommit: inspection.productCommit,
      baseCommit: inspection.deploymentCommit,
      branch: inspection.branch,
      origin: inspection.origin,
      plan,
      ...changes,
      preserved: plan.preserved,
      commit: null,
    };

    if (
      changes.added.length +
        changes.modified.length +
        changes.deleted.length ===
      0
    ) {
      return unchanged;
    }

    const message = buildCommitMessage({
      productCommit: inspection.productCommit,
      added: changes.added.length,
      modified: changes.modified.length,
      deleted: changes.deleted.length,
      preserved: plan.preserved.length,
    });

    // `--no-verify`: the product ships husky hooks, so the deployment has them
    // too, and a hook may reformat the staged tree or run a suite against a
    // database this tool knows nothing about. The commit is one ordinary
    // commit; the hooks belong to the deployment's own workflow.
    const committed = await runGit(
      ["commit", "--quiet", "--no-verify", "-m", message],
      inspection.deploymentPath,
    );
    if (committed.code !== 0) {
      throw new SyncFailure(`The commit failed: ${describeGit(committed)}`);
    }

    const sha = await gitText(["rev-parse", "HEAD"], inspection.deploymentPath);
    if (sha === null) {
      throw new SyncFailure(
        "The commit succeeded but its SHA could not be read back.",
      );
    }

    const parents =
      (await gitText(
        ["rev-list", "--parents", "-n", "1", "HEAD"],
        inspection.deploymentPath,
      )) ?? "";
    const parent = parents.split(" ").slice(1)[0] ?? null;

    return {
      ...unchanged,
      commit: { sha, parent, message, productCommit: inspection.productCommit },
    };
  } catch (error) {
    if (error instanceof SyncFailure) {
      return refuse(
        "git-failed",
        `${error.message} The deployment's working tree may be partly written: check \`git -C ${inspection.deploymentPath} status\` before running the sync again.`,
      );
    }

    return refuse(
      "git-failed",
      `The sync failed unexpectedly: ${
        error instanceof Error ? error.message : String(error)
      }. Check \`git -C ${inspection.deploymentPath} status\`.`,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
  }
}

export interface PushDeploymentInput {
  readonly deploymentPath: string;
  readonly branch: string;
}

/**
 * Publish the deployment's commit with a normal `git push`.
 *
 * There is no force variant here and never will be: the deployment's history is
 * the deployment's, and a sync that cannot fast-forward is a sync whose
 * assumptions are wrong — a human reads the rejection and decides.
 */
export async function pushDeployment(
  input: PushDeploymentInput,
): Promise<{ readonly ok: true } | SyncRefusal> {
  const pushed = await runGit(
    ["push", "origin", input.branch],
    input.deploymentPath,
  );

  if (pushed.code !== 0) {
    return refuse(
      "git-failed",
      `\`git push origin ${input.branch}\` was rejected: ${describeGit(
        pushed,
      )}. The commit is local and intact; reconcile the branch by hand and push again.`,
    );
  }

  return { ok: true };
}

/** The commit message: it names the product commit it came from. */
function buildCommitMessage(input: {
  readonly productCommit: string;
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
  readonly preserved: number;
}): string {
  const short = input.productCommit.slice(0, 7);

  return [
    `sync: update from product ${short}`,
    "",
    `Product commit: ${input.productCommit}`,
    `From the product: ${input.added} added, ${input.modified} changed, ${input.deleted} removed`,
    `Preserved from this deployment: ${input.preserved} paths`,
    "",
    "The product's tree was copied over this repository and the paths this",
    "deployment owns were restored from HEAD before the commit: every client",
    "package under src/site/, src/site/registry.ts, src/site/theme.css,",
    "src/site/seed.ts and public/. No force, no rewrite.",
  ].join("\n");
}

/** The deployment's own paths, as git pathspecs. */
function preservedPathspecs(plan: SyncPlan): string[] {
  const specs = plan.clientPackages.map((name) => `${SITE_DIRECTORY}/${name}`);

  for (const seam of SEAM_FILES) {
    if (!plan.missingSeams.includes(seam)) specs.push(seam);
  }

  if (!plan.missingSeams.includes(PUBLIC_DIRECTORY)) {
    specs.push(PUBLIC_DIRECTORY);
  }

  return specs;
}

/** An expected failure inside the mutating half: turned into a refusal. */
class SyncFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncFailure";
  }
}

interface ProcessOutcome {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ResolvedRepository {
  readonly ok: true;
  readonly root: string;
}

/**
 * The root of the repository a path points at, or a refusal.
 *
 * The path must **be** the root: a sync pointed at a subdirectory would commit a
 * partial tree over the deployment, and the resulting diff would look like a
 * hundred deletions nobody asked for.
 */
async function repositoryRoot(
  target: string,
  label: string,
): Promise<ResolvedRepository | SyncRefusal> {
  let resolved: string;

  try {
    const info = await stat(target);
    if (!info.isDirectory()) {
      return refuse(
        "not-a-directory",
        `The ${label} path ${target} is not a directory. Pass the root of the ${label} repository.`,
      );
    }
    resolved = await realpath(target);
  } catch {
    return refuse(
      "not-a-directory",
      `The ${label} path ${target} does not exist. Pass the root of the ${label} repository.`,
    );
  }

  const topLevel = await gitText(["rev-parse", "--show-toplevel"], resolved);
  if (topLevel === null) {
    return refuse(
      "not-a-repository-root",
      `The ${label} path ${target} is not inside a git repository. The sync reads its HEAD and restores the preserved paths from it, so both sides must be repositories.`,
    );
  }

  const root = await realpath(topLevel).catch(() => path.resolve(topLevel));
  if (root !== resolved) {
    return refuse(
      "not-a-repository-root",
      `The ${label} path ${target} is not the root of a git repository: the repository root is ${root}. A sync pointed at a subdirectory would commit a partial tree.`,
    );
  }

  return { ok: true, root: resolved };
}

/** Every uncommitted path in a repository, tracked or not. */
async function dirtyPaths(repo: string): Promise<string[]> {
  const status = await gitText(["status", "--porcelain"], repo);

  if (status === null) return [];

  return status
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** `HEAD`'s commit, or `null` when the repository has none. */
async function resolveCommit(repo: string): Promise<string | null> {
  return gitText(["rev-parse", "--verify", "HEAD^{commit}"], repo);
}

/** The checked-out branch, or `null` on a detached HEAD. */
async function currentBranch(repo: string): Promise<string | null> {
  const branch = await gitText(["symbolic-ref", "--short", "-q", "HEAD"], repo);

  return branch === null || branch === "" ? null : branch;
}

/** Every file path in a repository's `HEAD` tree, sorted by git. */
async function listTree(repo: string): Promise<string[]> {
  const listed = await runGit(
    ["ls-tree", "-r", "-z", "--full-tree", "HEAD"],
    repo,
  );

  if (listed.code !== 0) {
    throw new SyncFailure(
      `Could not list the tree of ${repo}: ${describeGit(listed)}`,
    );
  }

  const paths: string[] = [];

  for (const entry of splitNul(listed.stdout)) {
    const separator = entry.indexOf("\t");
    if (separator === -1) continue;

    const [, type] = entry.slice(0, separator).split(" ");
    // Submodules are gitlinks, not blobs: their content lives in another
    // repository, so copying them is impossible and listing them would make the
    // plan lie.
    if (type !== "blob") continue;

    paths.push(entry.slice(separator + 1));
  }

  return paths;
}

async function copyInto(
  source: string,
  destination: string,
  relative: string,
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });

  const existing = await stat(destination).catch(() => null);
  if (existing?.isDirectory()) {
    throw new SyncFailure(
      `Cannot write ${relative}: the deployment has a directory where the product has a file. Move it aside and run the sync again.`,
    );
  }

  await copyFile(source, destination);
}

async function removeIfPresent(target: string): Promise<void> {
  try {
    await unlink(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return;

    throw new SyncFailure(
      `Could not remove ${target}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Remove the directories this sync emptied, deepest first.
 *
 * Only ancestors of paths the sync deleted are candidates, `rmdir` refuses a
 * non-empty directory, and the preserved paths and VCS directories are excluded:
 * a tidy tree is worth four lines, a sync that deletes a deployment's folder is
 * not.
 */
async function pruneEmptiedDirectories(
  root: string,
  removed: readonly string[],
  preserved: readonly string[],
): Promise<void> {
  const protectedPaths = new Set(preserved);
  const candidates = new Set<string>();

  for (const entry of removed) {
    let directory = path.posix.dirname(entry);
    while (directory !== "." && directory !== "/" && directory !== "") {
      candidates.add(directory);
      directory = path.posix.dirname(directory);
    }
  }

  const deepestFirst = [...candidates].sort(
    (left, right) => right.split("/").length - left.split("/").length,
  );

  for (const relative of deepestFirst) {
    if (protectedPaths.has(relative)) continue;
    if (NEVER_PRUNED.has(relative.split("/")[0])) continue;

    try {
      await rmdir(path.join(root, ...relative.split("/")));
    } catch {
      // Not empty, or already gone: both are the answer this call wants.
    }
  }
}

/** Runs git, never throwing on a non-zero exit: the caller decides. */
function runGit(args: readonly string[], cwd: string): Promise<ProcessOutcome> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", cwd, ...args],
      {
        encoding: "utf8",
        maxBuffer: GIT_MAX_BUFFER,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ code: 0, stdout, stderr });
          return;
        }

        const exitCode = typeof error.code === "number" ? error.code : -1;

        resolve({
          code: exitCode,
          stdout: stdout ?? "",
          stderr: stderr === "" ? error.message : stderr,
        });
      },
    );
  });
}

/** git's stdout, trimmed, or `null` when the command failed. */
async function gitText(
  args: readonly string[],
  cwd: string,
): Promise<string | null> {
  const outcome = await runGit(args, cwd);
  if (outcome.code !== 0) return null;

  return outcome.stdout.trim();
}

function describeGit(outcome: ProcessOutcome): string {
  const detail = outcome.stderr.trim() || outcome.stdout.trim();
  return detail === "" ? `git exited with ${outcome.code}` : detail;
}

/** `git diff --name-status -z --no-renames`, grouped by what happened. */
function parseNameStatus(output: string): {
  readonly added: string[];
  readonly modified: string[];
  readonly deleted: string[];
} {
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const tokens = splitNul(output);

  for (let index = 0; index + 1 < tokens.length; index += 2) {
    const status = tokens[index];
    const entry = tokens[index + 1];

    if (status.startsWith("A")) added.push(entry);
    else if (status.startsWith("D")) deleted.push(entry);
    else modified.push(entry);
  }

  return { added, modified, deleted };
}

function splitNul(output: string): string[] {
  return output.split("\0").filter((entry) => entry !== "");
}

function clientPackageOf(entry: string): string | null {
  const segments = normalizePath(entry).split("/");

  if (segments.length < 4) return null;
  if (segments[0] !== "src" || segments[1] !== "site") return null;

  const directory = segments[2];
  return SITE_DIRECTORY_EXCLUSIONS.has(directory) ? null : directory;
}

function normalizePath(entry: string): string {
  return entry.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function normalizeTree(entries: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const entry of entries) {
    const candidate = normalizePath(entry);
    if (candidate !== "") normalized.add(candidate);
  }

  return [...normalized].sort();
}

/** A few paths plus a count, so a refusal stays one readable paragraph. */
function summarise(paths: readonly string[]): string {
  const shown = paths.slice(0, 5).join(", ");
  const rest = paths.length - 5;

  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

function refuse(code: SyncRefusalCode, reason: string): SyncRefusal {
  return { ok: false, code, reason };
}
