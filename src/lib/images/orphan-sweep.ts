/**
 * The decision logic of the legacy orphan-image sweep, with no I/O.
 *
 * The sweep exists to delete one class of asset: an image that lives in the
 * deployment's Cloudinary folder, that no `Car.images` lists, and that has no
 * `ImageUpload` row. Assets *with* a row are modern orphans and the client
 * already deletes them, so this script must leave them alone.
 *
 * This file owns every rule — including the two aborts — so the rules are
 * unit-testable without a database or Cloudinary credentials, and so the shell
 * that runs it cannot drift from them. A Cloudinary account is shared by
 * definition, so the dangerous failure is not "one asset survived": it is
 * "everything looked orphaned because the database or the folder was wrong".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The share of listed assets above which the sweep refuses to run. */
export const MAX_DELETABLE_RATIO_PERCENT = 80;

export interface SweepAsset {
  /** `public_id` exactly as the Admin API returned it. */
  readonly publicId: string;
  /** ISO 8601, from the Admin API's `created_at`. */
  readonly createdAt: string;
  readonly bytes: number;
}

export type SweepDisposition =
  | "delete"
  | "skip-already-referenced"
  | "skip-already-recorded"
  | "skip-too-new";

export interface SweepAssetDecision extends SweepAsset {
  /** The storage key compared with `Car.images` and `ImageUpload.key`. */
  readonly key: string;
  readonly disposition: SweepDisposition;
}

export interface OrphanSweepInput {
  /** The Cloudinary folder the listing came from, e.g. `car-agency-app`. */
  readonly folder: string;
  readonly assets: readonly SweepAsset[];
  /** Every key listed by a car (`Car.images`, flattened). */
  readonly referencedKeys: ReadonlySet<string>;
  /** Every key with an `ImageUpload` row. */
  readonly recordedKeys: ReadonlySet<string>;
  readonly olderThanDays: number;
  /** Epoch milliseconds; injected so the boundary is testable. */
  readonly now: number;
  readonly allowHighRatio?: boolean;
}

export interface OrphanSweepSkipCounts {
  readonly alreadyReferenced: number;
  readonly alreadyRecorded: number;
  readonly tooNew: number;
}

export interface OrphanSweepOk {
  readonly ok: true;
  readonly deletable: readonly SweepAssetDecision[];
  readonly skipped: OrphanSweepSkipCounts;
  /** Bytes the deletion would free. */
  readonly totalBytes: number;
  /** Deletable share of the listed assets, 0–1. */
  readonly ratio: number;
  /** Every listed asset with its disposition, in input order. */
  readonly decisions: readonly SweepAssetDecision[];
}

export type OrphanSweepAbortCode = "empty-referenced-set" | "deletable-ratio";

export interface OrphanSweepAbort {
  readonly ok: false;
  readonly code: OrphanSweepAbortCode;
  readonly reason: string;
}

export type OrphanSweepResult = OrphanSweepOk | OrphanSweepAbort;

/**
 * The storage key a `public_id` maps to.
 *
 * An asset uploaded with `folder: "car-agency-app"` comes back from the Admin
 * API with the folder already inside `public_id` (`car-agency-app/abc123`),
 * which is the same shape `Car.images` and `ImageUpload.key` store. Prefixing
 * unconditionally would build `car-agency-app/car-agency-app/abc123`, match
 * nothing, and mark the entire account as orphaned — the exact disaster the
 * aborts below exist to stop. So the prefix is added only when it is absent,
 * which makes the composition idempotent whichever shape Cloudinary returns.
 */
export function composeStorageKey(folder: string, publicId: string): string {
  const normalized = folder.replace(/\/+$/, "");
  if (normalized === "") return publicId;

  const prefix = `${normalized}/`;
  return publicId.startsWith(prefix) ? publicId : `${prefix}${publicId}`;
}

export function sweepOrphanImages(input: OrphanSweepInput): OrphanSweepResult {
  const { assets, referencedKeys, recordedKeys, olderThanDays, now } = input;

  // Rule 4: an empty reference set means the database is wrong, not that the
  // whole account is orphaned. Runs before anything is classified.
  if (assets.length > 0 && referencedKeys.size === 0) {
    return {
      ok: false,
      code: "empty-referenced-set",
      reason:
        "Refusing to sweep: no car references any image, so every asset would look like an orphan. An empty Car table would mark the whole account as orphaned — check that this database and this folder belong together.",
    };
  }

  const decisions: SweepAssetDecision[] = assets.map((asset) => {
    const key = composeStorageKey(input.folder, asset.publicId);

    return {
      publicId: asset.publicId,
      key,
      createdAt: asset.createdAt,
      bytes: asset.bytes,
      disposition: classify(asset, key, referencedKeys, recordedKeys, {
        olderThanDays,
        now,
      }),
    };
  });

  const deletable = decisions.filter(
    (decision) => decision.disposition === "delete",
  );

  // Integer comparison on purpose: `deletable / total > 0.8` would make the
  // documented "exceeds 80%" boundary depend on float rounding.
  const exceedsRatio =
    deletable.length * 100 > assets.length * MAX_DELETABLE_RATIO_PERCENT;

  // Rule 5: a wrong database, a wrong folder prefix or an account shared
  // across environments all show up as "almost everything is an orphan".
  if (exceedsRatio && input.allowHighRatio !== true) {
    const percent = ((deletable.length / assets.length) * 100).toFixed(1);

    return {
      ok: false,
      code: "deletable-ratio",
      reason: `Refusing to sweep: ${deletable.length} of ${assets.length} assets (${percent}%) look like orphans, above the ${MAX_DELETABLE_RATIO_PERCENT}% safety limit. A wrong database, a wrong folder prefix, or an account shared across environments all produce this; nothing was deleted.`,
    };
  }

  return {
    ok: true,
    deletable,
    skipped: {
      alreadyReferenced: count(decisions, "skip-already-referenced"),
      alreadyRecorded: count(decisions, "skip-already-recorded"),
      tooNew: count(decisions, "skip-too-new"),
    },
    totalBytes: deletable.reduce((total, entry) => total + entry.bytes, 0),
    // No assets is an ok, empty sweep; it is not a 0/0 abort.
    ratio: assets.length === 0 ? 0 : deletable.length / assets.length,
    decisions,
  };
}

function classify(
  asset: SweepAsset,
  key: string,
  referencedKeys: ReadonlySet<string>,
  recordedKeys: ReadonlySet<string>,
  window: { readonly olderThanDays: number; readonly now: number },
): SweepDisposition {
  // Rules 1 and 2 come first: an asset the app still uses is never a candidate,
  // however old it is.
  if (referencedKeys.has(key)) return "skip-already-referenced";
  if (recordedKeys.has(key)) return "skip-already-recorded";

  const createdAt = Date.parse(asset.createdAt);
  // An unreadable timestamp is not evidence of age, so it is treated as too new
  // rather than as deletable.
  if (Number.isNaN(createdAt)) return "skip-too-new";

  // Whole days, floored: an asset exactly `olderThanDays` old is old enough,
  // and one second younger is not.
  const ageInDays = Math.floor((window.now - createdAt) / DAY_MS);
  if (ageInDays < window.olderThanDays) return "skip-too-new";

  return "delete";
}

function count(
  decisions: readonly SweepAssetDecision[],
  disposition: SweepDisposition,
): number {
  return decisions.filter((decision) => decision.disposition === disposition)
    .length;
}
