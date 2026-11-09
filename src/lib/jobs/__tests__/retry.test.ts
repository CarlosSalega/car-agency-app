import { describe, expect, it } from "vitest";

import {
  MAX_LAST_ERROR_LENGTH,
  claimNext,
  fail,
  recoverStale,
} from "@/lib/jobs/queue";
import { RateLimitedError } from "@/lib/jobs/types";
import { createFakeJobStore, findJob } from "./fake-job-store";

/**
 * Rules 3, 4 and 5: what a thrown error means.
 *
 * The distinction is the point of the whole retry design. A rate limit is the
 * upstream asking us to wait — the job is healthy, so `attempts` must not move.
 * Anything else is a failure, and a failure that reaches `maxAttempts` turns
 * into `DEAD` so the queue stops spending on it. A lock that outlived its
 * drainer is the third case: the job never reported, so recovery counts the
 * attempt itself.
 */

const NOW = new Date("2026-01-01T00:00:00.000Z");
const BACKOFF = { baseMs: 1_000, capMs: 8_000 } as const;

async function claimOne(store: ReturnType<typeof createFakeJobStore>) {
  const job = await claimNext(store, { now: NOW, workerId: "worker-1" });
  if (!job) throw new Error("expected a claimable job");

  return job;
}

describe("fail with a RateLimitedError", () => {
  it("reschedules without counting an attempt", async () => {
    const store = createFakeJobStore([
      { id: "job-1", kind: "publish", idempotencyKey: "k", runAt: NOW },
    ]);
    const claimed = await claimOne(store);

    const outcome = await fail(
      store,
      claimed,
      new RateLimitedError("slow down", 5_000),
      {
        now: NOW,
        backoff: BACKOFF,
      },
    );

    expect(outcome.rateLimited).toBe(true);
    expect(outcome.status).toBe("PENDING");

    const job = findJob(store, "job-1");
    expect(job.attempts).toBe(0);
    expect(job.status).toBe("PENDING");
    expect(job.runAt.getTime()).toBe(NOW.getTime() + 5_000);
    expect(job.lockedAt).toBeNull();
    expect(job.lockedBy).toBeNull();
  });

  it("falls back to the backoff when retryAfterMs is absent", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        runAt: NOW,
        attempts: 0,
      },
    ]);
    const claimed = await claimOne(store);

    await fail(store, claimed, new RateLimitedError(), {
      now: NOW,
      backoff: BACKOFF,
    });

    const job = findJob(store, "job-1");
    expect(job.attempts).toBe(0);
    expect(job.runAt.getTime()).toBe(NOW.getTime() + BACKOFF.baseMs);
  });

  it("does not resurrect a delivery deadline set by maxAttempts", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        runAt: NOW,
        attempts: 4,
        maxAttempts: 5,
      },
    ]);
    const claimed = await claimOne(store);

    await fail(store, claimed, new RateLimitedError(undefined, 1_000), {
      now: NOW,
      backoff: BACKOFF,
    });

    const job = findJob(store, "job-1");
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(4);
  });
});

describe("fail with any other error", () => {
  it("counts the attempt and reschedules with the backoff", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "update",
        idempotencyKey: "k",
        runAt: NOW,
        attempts: 0,
      },
    ]);
    const claimed = await claimOne(store);

    const outcome = await fail(store, claimed, new Error("channel said no"), {
      now: NOW,
      backoff: BACKOFF,
    });

    expect(outcome.rateLimited).toBe(false);
    expect(outcome.status).toBe("PENDING");
    expect(outcome.attempts).toBe(1);

    const job = findJob(store, "job-1");
    expect(job.attempts).toBe(1);
    expect(job.status).toBe("PENDING");
    expect(job.runAt.getTime()).toBe(NOW.getTime() + BACKOFF.baseMs);
    expect(job.lastError).toBe("channel said no");
    expect(job.lockedAt).toBeNull();
    expect(job.lockedBy).toBeNull();
  });

  it("grows the delay with the attempts already spent", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "update",
        idempotencyKey: "k",
        runAt: NOW,
        attempts: 3,
      },
    ]);
    const claimed = await claimOne(store);

    await fail(store, claimed, new Error("again"), {
      now: NOW,
      backoff: BACKOFF,
    });

    expect(findJob(store, "job-1").runAt.getTime()).toBe(NOW.getTime() + 8_000);
  });

  it("marks the job DEAD once the attempt count reaches maxAttempts", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        runAt: NOW,
        attempts: 4,
        maxAttempts: 5,
      },
    ]);
    const claimed = await claimOne(store);

    const outcome = await fail(store, claimed, new Error("last try"), {
      now: NOW,
      backoff: BACKOFF,
    });

    expect(outcome.status).toBe("DEAD");

    const job = findJob(store, "job-1");
    expect(job.status).toBe("DEAD");
    expect(job.attempts).toBe(5);
    expect(job.lastError).toBe("last try");
    expect(job.lockedAt).toBeNull();
    expect(job.lockedBy).toBeNull();
  });

  it("truncates an unbounded error message", async () => {
    const store = createFakeJobStore([
      { id: "job-1", kind: "publish", idempotencyKey: "k", runAt: NOW },
    ]);
    const claimed = await claimOne(store);
    const message = `x${"y".repeat(MAX_LAST_ERROR_LENGTH * 2)}`;

    await fail(store, claimed, new Error(message), {
      now: NOW,
      backoff: BACKOFF,
    });

    const job = findJob(store, "job-1");
    expect(job.lastError).toHaveLength(MAX_LAST_ERROR_LENGTH);
    expect(job.lastError).toBe(message.slice(0, MAX_LAST_ERROR_LENGTH));
  });

  it("describes a thrown non-Error without crashing", async () => {
    const store = createFakeJobStore([
      { id: "job-1", kind: "publish", idempotencyKey: "k", runAt: NOW },
    ]);
    const claimed = await claimOne(store);

    await fail(store, claimed, "plain string", { now: NOW, backoff: BACKOFF });

    expect(findJob(store, "job-1").lastError).toBe("plain string");
  });
});

describe("recoverStale", () => {
  const STALE_AFTER_MS = 15 * 60 * 1_000;

  it("returns a lock older than the timeout to PENDING and counts the attempt", async () => {
    const lockedAt = new Date(NOW.getTime() - STALE_AFTER_MS - 1);
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        status: "RUNNING",
        attempts: 1,
        lockedAt,
        lockedBy: "dead-worker",
      },
    ]);

    const recovered = await recoverStale(store, {
      now: NOW,
      staleAfterMs: STALE_AFTER_MS,
    });

    expect(recovered).toEqual([
      { id: "job-1", kind: "publish", status: "PENDING", attempts: 2 },
    ]);

    const job = findJob(store, "job-1");
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(2);
    expect(job.lockedAt).toBeNull();
    expect(job.lockedBy).toBeNull();
    expect(job.runAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it("leaves a lock inside the timeout untouched", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        status: "RUNNING",
        attempts: 1,
        lockedAt: new Date(NOW.getTime() - STALE_AFTER_MS + 1_000),
        lockedBy: "busy-worker",
      },
    ]);

    const recovered = await recoverStale(store, {
      now: NOW,
      staleAfterMs: STALE_AFTER_MS,
    });

    expect(recovered).toEqual([]);

    const job = findJob(store, "job-1");
    expect(job.status).toBe("RUNNING");
    expect(job.attempts).toBe(1);
    expect(job.lockedBy).toBe("busy-worker");
  });

  it("ignores PENDING rows, which have no lock to recover", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        status: "PENDING",
        attempts: 2,
      },
    ]);

    expect(
      await recoverStale(store, { now: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toEqual([]);
    expect(findJob(store, "job-1").attempts).toBe(2);
  });

  it("buries a lock that exhausted its attempts instead of recovering it forever", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        status: "RUNNING",
        attempts: 4,
        maxAttempts: 5,
        lockedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 1),
        lockedBy: "dead-worker",
      },
    ]);

    const recovered = await recoverStale(store, {
      now: NOW,
      staleAfterMs: STALE_AFTER_MS,
    });

    expect(recovered).toEqual([
      { id: "job-1", kind: "publish", status: "DEAD", attempts: 5 },
    ]);
    expect(findJob(store, "job-1").status).toBe("DEAD");
  });

  it("keeps the lock when another drainer recovered it first", async () => {
    const store = createFakeJobStore([
      {
        id: "job-1",
        kind: "publish",
        idempotencyKey: "k",
        status: "RUNNING",
        attempts: 0,
        lockedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 1),
        lockedBy: "dead-worker",
      },
    ]);

    // The competing recovery moved the row before this drainer's update landed.
    store.claimConflicts.add("job-1");

    const recovered = await recoverStale(store, {
      now: NOW,
      staleAfterMs: STALE_AFTER_MS,
    });

    expect(recovered).toEqual([]);
    expect(findJob(store, "job-1").attempts).toBe(0);
  });
});
