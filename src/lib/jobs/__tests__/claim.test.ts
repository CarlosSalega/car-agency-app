import { describe, expect, it } from "vitest";

import { claimNext } from "@/lib/jobs/queue";
import { createFakeJobStore } from "./fake-job-store";

/**
 * Rule 1: the claim is a compare-and-set, not a read-then-write.
 *
 * The race that matters is two drainers reading the same PENDING row and both
 * believing they own it. The fake reproduces the losing side by returning
 * `count: 0` from `updateMany`, which is exactly what Prisma returns when the
 * row no longer matches the filter.
 */

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("claimNext", () => {
  it("claims the oldest due job with a compare-and-set on id, status and runAt", async () => {
    const store = createFakeJobStore([
      {
        kind: "publish",
        idempotencyKey: "a",
        runAt: new Date(NOW.getTime() - 1_000),
      },
      { kind: "update", idempotencyKey: "b", runAt: NOW },
    ]);

    const claimed = await claimNext(store, { now: NOW, workerId: "worker-1" });

    expect(claimed?.idempotencyKey).toBe("a");
    expect(claimed?.status).toBe("RUNNING");
    expect(claimed?.lockedBy).toBe("worker-1");
    expect(claimed?.lockedAt?.getTime()).toBe(NOW.getTime());

    const update = store.calls.at(-1);
    expect(update?.kind).toBe("updateMany");
    expect(update).toMatchObject({
      where: { id: claimed?.id, status: "PENDING", runAt: { lte: NOW } },
      data: { status: "RUNNING", lockedAt: NOW, lockedBy: "worker-1" },
    });
  });

  it("returns null when nothing is claimable", async () => {
    const store = createFakeJobStore([]);

    expect(
      await claimNext(store, { now: NOW, workerId: "worker-1" }),
    ).toBeNull();
  });

  it("does not claim a job scheduled for later", async () => {
    const store = createFakeJobStore([
      {
        kind: "publish",
        idempotencyKey: "later",
        runAt: new Date(NOW.getTime() + 1),
      },
    ]);

    expect(
      await claimNext(store, { now: NOW, workerId: "worker-1" }),
    ).toBeNull();
    expect(store.jobs[0].status).toBe("PENDING");
  });

  it("does not claim a job another worker already holds", async () => {
    const store = createFakeJobStore([
      {
        kind: "publish",
        idempotencyKey: "running",
        status: "RUNNING",
        lockedAt: NOW,
        lockedBy: "worker-2",
      },
    ]);

    expect(
      await claimNext(store, { now: NOW, workerId: "worker-1" }),
    ).toBeNull();
  });

  it("skips the row it lost the race for and claims the next candidate", async () => {
    const store = createFakeJobStore([
      {
        kind: "publish",
        idempotencyKey: "first",
        runAt: new Date(NOW.getTime() - 2_000),
      },
      {
        kind: "update",
        idempotencyKey: "second",
        runAt: new Date(NOW.getTime() - 1_000),
      },
    ]);

    const first = store.jobs[0];
    store.claimConflicts.add(first.id);

    const claimed = await claimNext(store, { now: NOW, workerId: "worker-1" });

    expect(claimed?.idempotencyKey).toBe("second");

    // The row it lost stays free for its owner: no lock, still claimable.
    const lost = store.jobs.find((job) => job.id === first.id);
    expect(lost?.status).toBe("PENDING");
    expect(lost?.lockedBy).toBeNull();

    // It did not try the same id twice.
    const claimedIds = store.calls
      .filter((call) => call.kind === "updateMany")
      .map((call) =>
        typeof call.where.id === "string" ? call.where.id : undefined,
      );
    expect(claimedIds).toEqual([first.id, claimed?.id]);
  });

  it("gives up instead of looping forever when every candidate is contested", async () => {
    const store = createFakeJobStore([
      { kind: "publish", idempotencyKey: "a", runAt: NOW },
      { kind: "publish", idempotencyKey: "b", runAt: NOW },
    ]);

    for (const job of store.jobs) store.claimConflicts.add(job.id);

    expect(
      await claimNext(store, { now: NOW, workerId: "worker-1" }),
    ).toBeNull();
    expect(
      store.calls.filter((call) => call.kind === "updateMany").length,
    ).toBeLessThanOrEqual(10);
  });
});
