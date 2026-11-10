import { describe, expect, it } from "vitest";

import { RateLimitedError } from "@/lib/jobs/types";

import { publishPublication } from "../publish";
import {
  createHarness,
  NOW,
  publicationCar,
  publicationView,
  PUBLICATION_ID,
} from "./fake-publication";

/**
 * `publish` decides before it calls the marketplace.
 *
 * The whole point of T6 is that a missing attribute fails with a sentence
 * naming it, not with an opaque `400` from Mercado Libre. So the assertions
 * that matter are "did the create call happen at all" and "what does the stored
 * row say".
 */

describe("publish", () => {
  it("creates the item, persists the remote id and the snapshot, and traces the transition", async () => {
    const harness = createHarness();

    const result = await publishPublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    expect(result).toEqual({ outcome: "published", state: "PUBLISHED" });
    expect(harness.items.createItem).toHaveBeenCalledTimes(1);

    expect(harness.items.createItem.mock.calls[0][0]).toEqual({
      title: "Volkswagen Gol 1.6 Comfortline",
      categoryId: "MLA1744",
      price: 12_500_000,
      currencyId: "ARS",
      pictureUrls: [
        "https://cdn.example.com/w_800,h_600/cars/gol-front.jpg",
        "https://cdn.example.com/w_800,h_600/cars/gol-back.jpg",
      ],
      attributes: [
        { id: "BRAND", value_name: "Volkswagen" },
        { id: "MODEL", value_name: "Gol" },
        { id: "TRIM", value_name: "1.6 Comfortline" },
        { id: "VEHICLE_YEAR", value_name: "2018" },
      ],
    });

    // `detail` is the only variant: the marketplace 1200×1200 is T7.
    expect(harness.resolveImageUrl.mock.calls).toEqual([
      ["cars/gol-front", "detail"],
      ["cars/gol-back", "detail"],
    ]);

    expect(harness.publicationStore.updates.map((call) => call.patch)).toEqual([
      { state: "PUBLISHING", lastError: null },
      {
        state: "PUBLISHED",
        remoteId: "MLA100",
        remoteStatus: "active",
        remoteSubStatus: null,
        syncedSnapshot: {
          price: 12_500_000,
          title: "Volkswagen Gol 1.6 Comfortline",
          status: "active",
          pictureCount: 2,
        },
        syncedAt: NOW,
        lastError: null,
      },
    ]);

    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "create-started",
      "create",
    ]);
    expect(harness.publicationStore.events[1].payload).toEqual({
      remoteId: "MLA100",
      status: "active",
      price: 12_500_000,
      pictureCount: 2,
    });
  });

  it("is a no-op on a second delivery, because the queue can hand it over twice", async () => {
    const harness = createHarness({
      view: publicationView({
        remoteId: "MLA100",
        state: "PUBLISHED",
        syncedSnapshot: {
          price: 12_500_000,
          title: "Volkswagen Gol 1.6 Comfortline",
          status: "active",
          pictureCount: 2,
        },
      }),
    });

    const result = await publishPublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    expect(result).toEqual({
      outcome: "already-published",
      state: "PUBLISHED",
    });
    expect(harness.catalog.predictCategory).not.toHaveBeenCalled();
    expect(harness.items.createItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.updates).toEqual([]);
    expect(harness.publicationStore.events).toEqual([]);
  });

  it("fails with a Spanish sentence instead of a 400 when no category is predicted", async () => {
    const harness = createHarness({ prediction: null });

    const result = await publishPublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(view.state).toBe("FAILED");
    expect(view.lastError).toContain("categoría");
    expect(view.lastError).toContain("Volkswagen Gol 1.6 Comfortline");
    expect(harness.items.createItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "create-failed",
    ]);
  });

  it("names every missing attribute and never reaches the marketplace", async () => {
    const harness = createHarness({
      requiredAttributes: [
        { id: "COLOR", name: "Color", valueType: "list" },
        { id: "KILOMETERS", name: "Kilómetros", valueType: "number" },
      ],
    });

    const result = await publishPublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(view.state).toBe("FAILED");
    expect(view.lastError).toContain("Color");
    expect(view.lastError).toContain("COLOR");
    expect(view.lastError).toContain("Kilómetros");
    expect(view.lastError).toContain("KILOMETERS");
    expect(harness.items.createItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "create-failed",
    ]);
  });

  it("fails without a picture instead of publishing silently", async () => {
    const harness = createHarness({
      view: publicationView({ car: publicationCar({ images: [] }) }),
    });

    const result = await publishPublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(view.state).toBe("FAILED");
    expect(view.lastError).toContain("fotos");
    expect(harness.items.createItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "create-failed",
    ]);
  });

  it("lets the 429 through so the queue reschedules instead of failing the publication", async () => {
    const harness = createHarness();
    const rateLimited = new RateLimitedError("rate limited", 30_000);
    harness.items.createItem.mockRejectedValueOnce(rateLimited);

    await expect(
      publishPublication(harness.deps, PUBLICATION_ID, { now: NOW }),
    ).rejects.toBe(rateLimited);

    const view = harness.publicationStore.view();

    expect(view.state).toBe("PUBLISHING");
    expect(view.remoteId).toBeNull();
    expect(view.lastError).toBeNull();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "create-started",
    ]);
  });

  it("marks the publication FAILED when the create is rejected, so no retry can duplicate it", async () => {
    const harness = createHarness();
    harness.items.createItem.mockRejectedValueOnce(
      new Error("Mercado Libre answered 400: invalid attribute"),
    );

    const result = await publishPublication(harness.deps, PUBLICATION_ID, {
      now: NOW,
    });

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(view.state).toBe("FAILED");
    expect(view.remoteId).toBeNull();
    expect(view.lastError).toContain("Mercado Libre rechazó");
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "create-started",
      "create-failed",
    ]);
  });

  it("throws when the publication does not exist", async () => {
    const harness = createHarness();

    await expect(
      publishPublication(harness.deps, "missing", { now: NOW }),
    ).rejects.toThrow(/missing/);
  });
});
