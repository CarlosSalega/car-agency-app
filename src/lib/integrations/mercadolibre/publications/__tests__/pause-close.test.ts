import { describe, expect, it } from "vitest";

import { closePublication, pausePublication } from "../pause-close";
import {
  createHarness,
  publishedView,
  PUBLICATION_ID,
} from "./fake-publication";

describe("pause", () => {
  it("maps to a paused status and stores the remote state", async () => {
    const harness = createHarness({ view: publishedView() });

    const result = await pausePublication(harness.deps, PUBLICATION_ID);

    expect(result).toEqual({ outcome: "paused", state: "PAUSED" });
    expect(harness.items.updateItem).toHaveBeenCalledWith("MLA100", {
      status: "paused",
    });

    const view = harness.publicationStore.view();

    expect(view.state).toBe("PAUSED");
    expect(view.remoteStatus).toBe("paused");
    expect(view.lastError).toBeNull();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "pause",
    ]);
  });

  it("fails without an API call when the vehicle was never published", async () => {
    const harness = createHarness();

    const result = await pausePublication(harness.deps, PUBLICATION_ID);

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(harness.publicationStore.view().lastError).toContain(
      "Publicala primero",
    );
    expect(harness.items.updateItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "pause-failed",
    ]);
  });
});

describe("close", () => {
  it("maps to a closed status and removes the publication from the active set", async () => {
    const harness = createHarness({ view: publishedView() });

    const result = await closePublication(harness.deps, PUBLICATION_ID);

    expect(result).toEqual({ outcome: "closed", state: "REMOVED" });
    expect(harness.items.updateItem).toHaveBeenCalledWith("MLA100", {
      status: "closed",
    });

    const view = harness.publicationStore.view();

    expect(view.state).toBe("REMOVED");
    expect(view.remoteStatus).toBe("closed");
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "close",
    ]);
  });

  it("treats an already-closed item as success instead of an error", async () => {
    const harness = createHarness({
      view: publishedView(),
      item: { status: "closed" },
    });

    const result = await closePublication(harness.deps, PUBLICATION_ID);

    const view = harness.publicationStore.view();

    expect(result).toEqual({ outcome: "closed", state: "REMOVED" });
    expect(harness.items.getItem).toHaveBeenCalledTimes(1);
    expect(harness.items.updateItem).not.toHaveBeenCalled();
    expect(view.state).toBe("REMOVED");
    expect(view.remoteStatus).toBe("closed");
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "close",
    ]);
  });

  it("fails without an API call when the vehicle was never published", async () => {
    const harness = createHarness();

    const result = await closePublication(harness.deps, PUBLICATION_ID);

    expect(result).toEqual({ outcome: "failed", state: "FAILED" });
    expect(harness.publicationStore.view().lastError).toContain(
      "Publicala primero",
    );
    expect(harness.items.getItem).not.toHaveBeenCalled();
    expect(harness.publicationStore.events.map((event) => event.kind)).toEqual([
      "close-failed",
    ]);
  });
});
