import { describe, expect, it } from "vitest";

import { demoSeed } from "@/site/demo/seed";
import { seedData } from "@/site/seed";

/**
 * The catalogue, the sellers, the users and the links live behind the client
 * seam, next to the identity and the copy.
 *
 * They used to sit in `prisma/seed/`, which the product owns and the sync
 * overwrites, so every product update replaced a deployment's inventory with the
 * demo's. The seam file is the fix: the product ships the demo set, and a
 * deployment points that one file at its own package.
 *
 * The assertions here are deliberately not about the demo's contents — a
 * deployment that seeds forty cars instead of eighteen has to pass them — only
 * about the seam carrying a complete set and that set being internally
 * consistent. The demo's own numbers are pinned in
 * `src/site/demo/seed/__tests__/demo-seed.test.ts`.
 */
describe("the seed data behind the seam", () => {
  it("is the client's set, reached through one indirection", () => {
    // The seam points at the demo package in this repository. In a deployment it
    // points at that deployment's package, and this assertion is about the
    // pointer, not about the demo.
    expect(seedData).toBe(demoSeed);
  });

  it("carries every data set the seed writes", () => {
    expect(Array.isArray(seedData.cars)).toBe(true);
    expect(seedData.cars.length).toBeGreaterThan(0);
    expect(seedData.users.length).toBeGreaterThan(0);
    expect(seedData.sellers.length).toBeGreaterThan(0);
    expect(seedData.linkTree.length).toBeGreaterThan(0);
    expect(seedData.imageManifest.entries.length).toBeGreaterThan(0);
  });

  it("attaches every vehicle to a seller that the same set creates", () => {
    const sellerKeys = new Set(seedData.sellers.map((seller) => seller.key));

    for (const car of seedData.cars) {
      if (car.sellerKey === null) continue;
      expect(
        sellerKeys.has(car.sellerKey),
        `${car.key} points at seller ${car.sellerKey}, which the set does not create`,
      ).toBe(true);
    }
  });
});
