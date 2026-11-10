import { describe, expect, it } from "vitest";

import { updatePublication } from "../update";
import {
  createHarness,
  NOW,
  publicationCar,
  publishedView,
  PUBLICATION_ID,
} from "./fake-publication";

/**
 * D1, as code: a read that disagrees with the snapshot belongs to a human, and
 * "sold" is an intent that closes without asking.
 */

describe("update", () => {
  it("moves to DIVERGED and writes nothing when the remote price is not the one we sent", async () => {
    const harness = createHarness({
      view: publishedView(),
      item: { price: 13_000_000 },
    });

    const result = await updatePublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "diverged", state: "DIVERGED" });
    expect(view.state).toBe("DIVERGED");
    expect(view.lastError).toContain("13000000");
    expect(view.lastError).toContain("12500000");
    expect(harness.items.updateItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "diverged",
    ]);
    expect(harness.publicationStore.events[0].payload).toEqual({
      remotePrice: 13_000_000,
      snapshotPrice: 12_500_000,
    });
  });

  it("pushes the new price and refreshes the snapshot when only the local price moved", async () => {
    const harness = createHarness({
      view: publishedView({
        car: publicationCar({ price: 11_900_000 }),
        // What we last sent is the old price: that is what makes the local move
        // a safe push instead of the remote edit that would be a divergence.
        syncedSnapshot: {
          price: 12_500_000,
          title: "Volkswagen Gol 1.6 Comfortline",
          status: "active",
          pictureCount: 2,
        },
      }),
      item: { price: 12_500_000, status: "active" },
    });

    const result = await updatePublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    expect(result).toEqual({ outcome: "price-updated", state: "PUBLISHED" });
    expect(harness.items.updateItem).toHaveBeenCalledTimes(1);
    expect(harness.items.updateItem).toHaveBeenCalledWith("MLA100", {
      price: 11_900_000,
    });

    const view = harness.publicationStore.view();

    expect(view.state).toBe("PUBLISHED");
    expect(view.syncedSnapshot).toEqual({
      price: 11_900_000,
      title: "Volkswagen Gol 1.6 Comfortline",
      status: "active",
      pictureCount: 2,
    });
    expect(view.syncedAt).toBe(NOW);
    expect(view.lastError).toBeNull();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "price-update",
    ]);
  });

  it("closes a sold vehicle unconditionally, with no divergence check", async () => {
    const harness = createHarness({
      view: publishedView({ car: publicationCar({ status: "SOLD" }) }),
      item: { price: 99_000_000 },
    });

    const result = await updatePublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "sold-closed", state: "REMOVED" });
    expect(harness.items.updateItem).toHaveBeenCalledTimes(1);
    expect(harness.items.updateItem).toHaveBeenCalledWith("MLA100", {
      status: "closed",
    });
    expect(view.state).toBe("REMOVED");
    expect(view.remoteStatus).toBe("closed");
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "sold-close",
    ]);
  });

  it("treats a sold date as the same intent as the SOLD status", async () => {
    const harness = createHarness({
      view: publishedView({
        car: publicationCar({ soldAt: new Date("2026-03-09T00:00:00.000Z") }),
      }),
    });

    const result = await updatePublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    expect(result).toEqual({ outcome: "sold-closed", state: "REMOVED" });
    expect(harness.items.updateItem).toHaveBeenCalledWith("MLA100", {
      status: "closed",
    });
  });

  it("does nothing when the local price already matches the snapshot", async () => {
    const harness = createHarness({ view: publishedView() });

    const result = await updatePublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    expect(result).toEqual({ outcome: "unchanged", state: "PUBLISHED" });
    expect(harness.items.updateItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.updates).toEqual([]);
    expect(harness.publicationStore.events).toEqual([]);
  });

  it("fails with a plain sentence when there is nothing to update remotely", async () => {
    const harness = createHarness();

    const result = await updatePublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(view.state).toBe("FAILED");
    expect(view.lastError).toContain("Publicala primero");
    expect(harness.items.getItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "update-failed",
    ]);
  });
});
