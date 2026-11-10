import { describe, expect, it } from "vitest";

import { syncPublication } from "../sync";
import {
  createHarness,
  publishedView,
  PUBLICATION_ID,
} from "./fake-publication";

/**
 * T10's distinction, pinned: a transient marketplace state is recorded, not
 * reported as a failure, and only a real disagreement with what we sent moves
 * the publication to DIVERGED.
 */

describe("sync", () => {
  it("records a picture-processing pause as transient, not as a failure", async () => {
    const harness = createHarness({
      view: publishedView(),
      item: { status: "paused", subStatus: "picture downloading pending" },
    });

    const result = await syncPublication(harness.deps, PUBLICATION_ID);

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "synced", state: "PUBLISHED" });
    expect(view.state).toBe("PUBLISHED");
    expect(view.remoteStatus).toBe("paused");
    expect(view.remoteSubStatus).toBe("picture downloading pending");
    expect(view.lastError).toBeNull();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "sync",
    ]);
  });

  it("records under_review without treating it as an error", async () => {
    const harness = createHarness({
      view: publishedView(),
      item: { status: "under_review", subStatus: null },
    });

    const result = await syncPublication(harness.deps, PUBLICATION_ID);

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "synced", state: "PUBLISHED" });
    expect(view.remoteStatus).toBe("under_review");
    expect(view.lastError).toBeNull();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "sync",
    ]);
  });

  it("moves to DIVERGED when the remote price disagrees with the snapshot", async () => {
    const harness = createHarness({
      view: publishedView(),
      item: { price: 13_500_000 },
    });

    const result = await syncPublication(harness.deps, PUBLICATION_ID);

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "synced", state: "DIVERGED" });
    expect(view.state).toBe("DIVERGED");
    expect(view.remoteStatus).toBe("active");
    expect(view.lastError).toContain("13500000");
    expect(view.lastError).toContain("12500000");
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "sync-diverged",
    ]);
    expect(harness.publicationStore.events[0].payload).toEqual({
      remoteStatus: "active",
      remoteSubStatus: null,
      state: "DIVERGED",
      remotePrice: 13_500_000,
      snapshotPrice: 12_500_000,
    });
  });

  it("maps a closed item to REMOVED, because a closed listing is not live", async () => {
    const harness = createHarness({
      view: publishedView(),
      item: { status: "closed", price: 13_500_000 },
    });

    const result = await syncPublication(harness.deps, PUBLICATION_ID);

    expect(result).toEqual({ outcome: "synced", state: "REMOVED" });
    expect(harness.publicationStore.view().state).toBe("REMOVED");
  });

  it("fails without an API call when there is no remote item to read", async () => {
    const harness = createHarness();

    const result = await syncPublication(harness.deps, PUBLICATION_ID);

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(harness.publicationStore.view().lastError).toContain(
      "Publicala primero",
    );
    expect(harness.items.getItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "sync-failed",
    ]);
  });
});
