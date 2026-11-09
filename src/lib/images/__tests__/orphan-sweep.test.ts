import { describe, expect, it } from "vitest";

import {
  composeStorageKey,
  sweepOrphanImages,
} from "@/lib/images/orphan-sweep";
import type { OrphanSweepInput, SweepAsset } from "@/lib/images/orphan-sweep";

/**
 * The sweep's decision logic is pure, so every safety rule is pinned here
 * instead of being verified by running a destructive script.
 *
 * The two aborts (rule 4 and rule 5) exist because a wrong database, a wrong
 * folder prefix or a Cloudinary account shared across environments all make
 * *every* asset look orphaned. Their reasons are asserted verbatim: an operator
 * reads them at 3am and has to act on them.
 */

const FOLDER = "car-agency-app";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-01-15T00:00:00.000Z");

function daysAgoIso(days: number, extraMs = 0): string {
  return new Date(NOW - days * DAY_MS - extraMs).toISOString();
}

function asset(
  publicId: string,
  options: { readonly daysAgo: number; readonly bytes?: number },
): SweepAsset {
  return {
    publicId,
    createdAt: daysAgoIso(options.daysAgo),
    bytes: options.bytes ?? 1000,
  };
}

/** A referenced set that is never empty, so rule 4 stays out of the way. */
const SOME_CAR_KEY = `${FOLDER}/keep-attached`;
const SOME_UPLOAD_KEY = `${FOLDER}/keep-recorded`;

function input(overrides: Partial<OrphanSweepInput> = {}): OrphanSweepInput {
  return {
    folder: FOLDER,
    assets: [],
    referencedKeys: new Set([SOME_CAR_KEY]),
    recordedKeys: new Set([SOME_UPLOAD_KEY]),
    olderThanDays: 7,
    now: NOW,
    ...overrides,
  };
}

describe("sweepOrphanImages", () => {
  it("deletes only old assets that neither a car lists nor an upload record holds", () => {
    const result = sweepOrphanImages(
      input({
        assets: [
          asset("orphan", { daysAgo: 30, bytes: 1000 }),
          asset("keep-attached", { daysAgo: 30, bytes: 2000 }),
          asset("keep-recorded", { daysAgo: 30, bytes: 3000 }),
          asset("fresh", { daysAgo: 2, bytes: 4000 }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: true,
      deletable: [
        {
          publicId: "orphan",
          key: `${FOLDER}/orphan`,
          createdAt: daysAgoIso(30),
          bytes: 1000,
          disposition: "delete",
        },
      ],
      skipped: { alreadyReferenced: 1, alreadyRecorded: 1, tooNew: 1 },
      totalBytes: 1000,
      ratio: 0.25,
      decisions: [
        {
          publicId: "orphan",
          key: `${FOLDER}/orphan`,
          createdAt: daysAgoIso(30),
          bytes: 1000,
          disposition: "delete",
        },
        {
          publicId: "keep-attached",
          key: `${FOLDER}/keep-attached`,
          createdAt: daysAgoIso(30),
          bytes: 2000,
          disposition: "skip-already-referenced",
        },
        {
          publicId: "keep-recorded",
          key: `${FOLDER}/keep-recorded`,
          createdAt: daysAgoIso(30),
          bytes: 3000,
          disposition: "skip-already-recorded",
        },
        {
          publicId: "fresh",
          key: `${FOLDER}/fresh`,
          createdAt: daysAgoIso(2),
          bytes: 4000,
          disposition: "skip-too-new",
        },
      ],
    });
  });

  it("rule 1: skips an asset whose key a car references, even with no upload record", () => {
    const result = sweepOrphanImages(
      input({ assets: [asset("keep-attached", { daysAgo: 365 })] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable).toEqual([]);
    expect(result.skipped).toEqual({
      alreadyReferenced: 1,
      alreadyRecorded: 0,
      tooNew: 0,
    });
    expect(result.decisions[0]?.disposition).toBe("skip-already-referenced");
    expect(result.totalBytes).toBe(0);
  });

  it("rule 2: skips an asset that has an ImageUpload row, even with no car", () => {
    const result = sweepOrphanImages(
      input({
        assets: [asset("recorded", { daysAgo: 365 })],
        referencedKeys: new Set([SOME_CAR_KEY]),
        recordedKeys: new Set([`${FOLDER}/recorded`]),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable).toEqual([]);
    expect(result.skipped).toEqual({
      alreadyReferenced: 0,
      alreadyRecorded: 1,
      tooNew: 0,
    });
    expect(result.decisions[0]?.disposition).toBe("skip-already-recorded");
  });

  it("rule 3: skips an asset younger than olderThanDays whole days, while an asset exactly olderThanDays old is deletable", () => {
    const result = sweepOrphanImages(
      input({
        assets: [
          asset("almost-old", { daysAgo: 6, bytes: 100 }),
          asset("exactly-old", { daysAgo: 7, bytes: 200 }),
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable.map((entry) => entry.publicId)).toEqual([
      "exactly-old",
    ]);
    expect(result.skipped).toEqual({
      alreadyReferenced: 0,
      alreadyRecorded: 0,
      tooNew: 1,
    });
    expect(result.totalBytes).toBe(200);
  });

  it("rule 4: aborts when no car references anything and there are assets", () => {
    const result = sweepOrphanImages(
      input({
        assets: [
          asset("a", { daysAgo: 30 }),
          asset("b", { daysAgo: 30 }),
          asset("c", { daysAgo: 30 }),
        ],
        referencedKeys: new Set(),
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "empty-referenced-set",
      reason:
        "Refusing to sweep: no car references any image, so every asset would look like an orphan. An empty Car table would mark the whole account as orphaned — check that this database and this folder belong together.",
    });
  });

  it("rule 5: aborts when the deletable share exceeds 80% of the assets, naming the observed ratio", () => {
    const result = sweepOrphanImages(
      input({
        assets: [
          asset("a", { daysAgo: 30 }),
          asset("b", { daysAgo: 30 }),
          asset("c", { daysAgo: 30 }),
          asset("d", { daysAgo: 30 }),
          asset("e", { daysAgo: 30 }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "deletable-ratio",
      reason:
        "Refusing to sweep: 5 of 5 assets (100.0%) look like orphans, above the 80% safety limit. A wrong database, a wrong folder prefix, or an account shared across environments all produce this; nothing was deleted.",
    });
  });

  it("rule 5 boundary: a deletable share of exactly 80% is not an abort", () => {
    const assets = [
      ...Array.from({ length: 8 }, (_, index) =>
        asset(`orphan-${index}`, { daysAgo: 30 }),
      ),
      asset("keep-attached", { daysAgo: 30 }),
      asset("keep-recorded", { daysAgo: 30 }),
    ];

    const result = sweepOrphanImages(input({ assets }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable).toHaveLength(8);
    expect(result.ratio).toBe(0.8);
  });

  it("rule 5 override: allowHighRatio keeps the sweep running", () => {
    const assets = [
      asset("a", { daysAgo: 30, bytes: 10 }),
      asset("b", { daysAgo: 30, bytes: 20 }),
    ];

    const result = sweepOrphanImages(input({ assets, allowHighRatio: true }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable.map((entry) => entry.publicId)).toEqual(["a", "b"]);
    expect(result.ratio).toBe(1);
    expect(result.totalBytes).toBe(30);
  });

  it("returns an ok result with nothing to delete when there are no assets", () => {
    const result = sweepOrphanImages(
      input({ assets: [], referencedKeys: new Set() }),
    );

    expect(result).toEqual({
      ok: true,
      deletable: [],
      skipped: { alreadyReferenced: 0, alreadyRecorded: 0, tooNew: 0 },
      totalBytes: 0,
      ratio: 0,
      decisions: [],
    });
  });

  it("treats an unreadable createdAt as too new instead of deletable", () => {
    const result = sweepOrphanImages(
      input({
        assets: [{ publicId: "broken", createdAt: "not-a-date", bytes: 5 }],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable).toEqual([]);
    expect(result.skipped).toEqual({
      alreadyReferenced: 0,
      alreadyRecorded: 0,
      tooNew: 1,
    });
  });
});

describe("composeStorageKey", () => {
  it("prefixes the folder once, and never twice, so a full public_id still matches its car", () => {
    expect(composeStorageKey(FOLDER, "abc123")).toBe(`${FOLDER}/abc123`);
    expect(composeStorageKey(FOLDER, `${FOLDER}/abc123`)).toBe(
      `${FOLDER}/abc123`,
    );
    expect(composeStorageKey(`${FOLDER}/`, "abc123")).toBe(`${FOLDER}/abc123`);
  });

  it("matches the key Cloudinary returns against Car.images instead of orphaning it", () => {
    const result = sweepOrphanImages(
      input({
        assets: [asset(`${FOLDER}/listed-by-a-car`, { daysAgo: 30 })],
        referencedKeys: new Set([`${FOLDER}/listed-by-a-car`]),
        recordedKeys: new Set(),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.deletable).toEqual([]);
    expect(result.decisions[0]?.key).toBe(`${FOLDER}/listed-by-a-car`);
    expect(result.skipped.alreadyReferenced).toBe(1);
  });
});
