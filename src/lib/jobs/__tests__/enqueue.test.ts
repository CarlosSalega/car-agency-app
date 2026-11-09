import { describe, expect, it } from "vitest";

import { enqueue } from "@/lib/jobs/queue";
import { buildIdempotencyKey } from "@/lib/jobs/idempotency";
import { createFakeJobStore, findJob } from "./fake-job-store";

/**
 * Rule 2: `enqueue` upserts on `idempotencyKey`.
 *
 * Two requests asking for the same publication must produce one row, and a key
 * whose row already reached a terminal status is a new intent: it is revived
 * instead of being ignored forever. A PENDING or RUNNING row is left alone,
 * because reviving a running job is how the same vehicle gets published twice.
 */

const NOW = new Date("2026-01-01T00:00:00.000Z");

const KEY = buildIdempotencyKey({
  kind: "publish",
  channel: "MERCADOLIBRE",
  accountId: "account-1",
  carId: "car-1",
});

describe("enqueue", () => {
  it("creates a PENDING job that is due now", async () => {
    const store = createFakeJobStore();

    const job = await enqueue(store, {
      kind: "publish",
      idempotencyKey: KEY,
      payload: { carId: "car-1" },
      now: NOW,
    });

    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(0);
    expect(job.runAt.getTime()).toBe(NOW.getTime());
    expect(job.maxAttempts).toBe(5);
    expect(store.jobs).toHaveLength(1);
    expect(store.calls[0].kind).toBe("upsert");
  });

  it("honours a delayed runAt and a custom maxAttempts", async () => {
    const store = createFakeJobStore();
    const runAt = new Date(NOW.getTime() + 60_000);

    const job = await enqueue(store, {
      kind: "update",
      idempotencyKey: KEY,
      runAt,
      maxAttempts: 3,
      now: NOW,
    });

    expect(job.runAt.getTime()).toBe(runAt.getTime());
    expect(job.maxAttempts).toBe(3);
  });

  it("enqueueing twice produces one row", async () => {
    const store = createFakeJobStore();

    const first = await enqueue(store, {
      kind: "publish",
      idempotencyKey: KEY,
      now: NOW,
    });
    const second = await enqueue(store, {
      kind: "publish",
      idempotencyKey: KEY,
      now: NOW,
    });

    expect(store.jobs).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });

  it("revives a terminal job as PENDING with attempts reset and a fresh runAt", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: KEY,
        status: "SUCCEEDED",
        attempts: 4,
        runAt: new Date(NOW.getTime() - 60_000),
        lockedAt: new Date(NOW.getTime() - 30_000),
        lockedBy: "worker-1",
        lastError: "old failure",
      },
    ]);

    const later = new Date(NOW.getTime() + 1_000);
    const job = await enqueue(store, {
      kind: "publish",
      idempotencyKey: KEY,
      payload: { carId: "car-1", price: 2 },
      now: NOW,
      runAt: later,
    });

    expect(job.id).toBe("job-1");
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(0);
    expect(job.runAt.getTime()).toBe(later.getTime());
    expect(job.lockedAt).toBeNull();
    expect(job.lockedBy).toBeNull();
    expect(job.lastError).toBeNull();
    expect(job.payload).toEqual({ carId: "car-1", price: 2 });
  });

  it("revives every terminal status, including DEAD", async () => {
    for (const status of ["SUCCEEDED", "FAILED", "DEAD"] as const) {
      const store = createFakeJobStore([
        {
          id: "job-1",
          kind: "close",
          idempotencyKey: KEY,
          status,
          attempts: 2,
        },
      ]);

      const job = await enqueue(store, {
        kind: "close",
        idempotencyKey: KEY,
        now: NOW,
      });

      expect(job.status).toBe("PENDING");
      expect(job.attempts).toBe(0);
    }
  });

  it("leaves a PENDING row's attempt count and runAt alone", async () => {
    const scheduled = new Date(NOW.getTime() + 120_000);
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: KEY,
        status: "PENDING",
        attempts: 2,
        runAt: scheduled,
        lastError: "boom",
      },
    ]);

    const job = await enqueue(store, {
      kind: "publish",
      idempotencyKey: KEY,
      now: NOW,
    });

    expect(job.attempts).toBe(2);
    expect(job.runAt.getTime()).toBe(scheduled.getTime());
    expect(job.lastError).toBe("boom");
  });

  it("never resets a RUNNING job, which another worker owns", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: KEY,
        status: "RUNNING",
        attempts: 1,
        lockedAt: NOW,
        lockedBy: "worker-2",
      },
    ]);

    await enqueue(store, { kind: "publish", idempotencyKey: KEY, now: NOW });

    const job = findJob(store, "job-1");
    expect(job.status).toBe("RUNNING");
    expect(job.attempts).toBe(1);
    expect(job.lockedBy).toBe("worker-2");
  });
});
