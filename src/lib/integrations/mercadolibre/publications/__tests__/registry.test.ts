import { describe, expect, it } from "vitest";

import { JOB_KINDS, type JobRow } from "@/lib/jobs/types";

import { createMeliJobRegistry, parsePublicationJobPayload } from "../index";
import { createHarness, NOW, PUBLICATION_ID } from "./fake-publication";

function job(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    kind: "publish",
    idempotencyKey: "publish:MERCADOLIBRE:account-1:car-1",
    payload: { publicationId: PUBLICATION_ID },
    status: "RUNNING",
    attempts: 0,
    maxAttempts: 3,
    runAt: NOW,
    lockedAt: NOW,
    lockedBy: "worker-1",
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("the Mercado Libre job registry", () => {
  it("maps every job kind the queue knows", () => {
    const harness = createHarness();
    const registry = createMeliJobRegistry(harness.deps);

    expect([...registry.keys()].sort()).toEqual([...JOB_KINDS].sort());

    for (const kind of JOB_KINDS) {
      expect(registry.get(kind)).toBeTypeOf("function");
    }
  });

  it("runs the handler with the publication id and the drainer's clock", async () => {
    const harness = createHarness();
    const handler = createMeliJobRegistry(harness.deps).get("publish");

    await handler?.({ job: job(), workerId: "worker-1", now: NOW });

    expect(harness.items.createItem).toHaveBeenCalledTimes(1);
    expect(harness.publicationStore.view().syncedAt).toBe(NOW);
  });

  it("refuses a payload without a publication id instead of guessing one", async () => {
    const harness = createHarness();
    const handler = createMeliJobRegistry(harness.deps).get("update");

    await expect(
      handler?.({ job: job({ payload: {} }), workerId: "worker-1", now: NOW }),
    ).rejects.toThrow(/publicationId/);
    expect(harness.items.getItem).not.toHaveBeenCalled();
  });

  it("reads the id out of a payload shaped like the one the CLI enqueues", () => {
    const harness = createHarness();
    const registry = createMeliJobRegistry(harness.deps);

    expect(parsePublicationJobPayload({ publicationId: "pub-9" })).toBe(
      "pub-9",
    );
    expect(registry.size).toBe(JOB_KINDS.length);
  });
});
