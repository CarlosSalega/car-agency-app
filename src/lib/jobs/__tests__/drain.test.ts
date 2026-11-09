import { describe, expect, it, vi } from "vitest";

import { drain, listClaimable } from "@/lib/jobs/queue";
import {
  RateLimitedError,
  type JobHandler,
  type JobRegistry,
} from "@/lib/jobs/types";
import { createFakeJobStore, findJob, type SeedJob } from "./fake-job-store";

/**
 * Rule 6: the loop itself.
 *
 * `drain` is sequential by design — never two jobs in parallel, because the
 * only consumer is a marketplace that documents no numeric limit and asks for
 * low concurrency. It stops when the claim returns nothing, and one bad job
 * (unregistered kind, throwing handler) must not take the queue with it.
 */

const NOW = new Date("2026-01-01T00:00:00.000Z");
const WORKER = "worker-1";

function registry(handlers: Record<string, JobHandler>): JobRegistry {
  return new Map(Object.entries(handlers));
}

function due(overrides: Partial<SeedJob> = {}): SeedJob {
  return {
    kind: "publish",
    idempotencyKey: overrides.idempotencyKey ?? "k",
    runAt: NOW,
    ...overrides,
  };
}

describe("drain", () => {
  it("stops immediately when nothing is claimable", async () => {
    const store = createFakeJobStore([]);
    const handler = vi.fn<JobHandler>();

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(summary.claimed).toBe(0);
    expect(summary.outcomes).toEqual([]);
  });

  it("claims at most `limit` jobs", async () => {
    const store = createFakeJobStore(
      Array.from({ length: 5 }, (_, index) =>
        due({ id: `job-${index + 1}`, idempotencyKey: `k${index}` }),
      ),
    );
    const handler = vi.fn<JobHandler>();

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
      limit: 2,
    });

    expect(summary.claimed).toBe(2);
    expect(summary.succeeded).toBe(2);
    expect(summary.outcomes.map((outcome) => outcome.jobId)).toEqual([
      "job-1",
      "job-2",
    ]);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(store.jobs.filter((job) => job.status === "PENDING")).toHaveLength(
      3,
    );
  });

  it("never runs the same job twice", async () => {
    const store = createFakeJobStore([due({ id: "job-1" })]);
    const handler = vi.fn<JobHandler>();

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
      limit: 10,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(summary.succeeded).toBe(1);
    expect(findJob(store, "job-1").status).toBe("SUCCEEDED");
  });

  it("runs jobs one after another, never in parallel", async () => {
    const store = createFakeJobStore([
      due({ id: "job-1", idempotencyKey: "a" }),
      due({ id: "job-2", idempotencyKey: "b" }),
    ]);
    let running = 0;
    let maxConcurrent = 0;

    const handler: JobHandler = async () => {
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      await Promise.resolve();
      running -= 1;
    };

    await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(maxConcurrent).toBe(1);
  });

  it("hands the handler the claimed row, the worker id and the injected clock", async () => {
    const store = createFakeJobStore([due({ id: "job-1" })]);
    const seen: unknown[] = [];

    await drain({
      store,
      registry: registry({
        publish: (context) => {
          seen.push({
            id: context.job.id,
            status: context.job.status,
            lockedBy: context.job.lockedBy,
            workerId: context.workerId,
            now: context.now.getTime(),
          });
        },
      }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(seen).toEqual([
      {
        id: "job-1",
        status: "RUNNING",
        lockedBy: WORKER,
        workerId: WORKER,
        now: NOW.getTime(),
      },
    ]);
  });

  it("marks an unregistered kind FAILED with a readable message and keeps going", async () => {
    const store = createFakeJobStore([
      due({ id: "job-1", idempotencyKey: "unknown-kind", kind: "teleport" }),
      due({ id: "job-2", idempotencyKey: "known-kind" }),
    ]);
    const handler = vi.fn<JobHandler>();

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);

    const failed = findJob(store, "job-1");
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(0);
    expect(failed.lockedAt).toBeNull();
    expect(failed.lastError).toBe(
      'No handler is registered for job kind "teleport". Register one in the drainer or stop enqueueing this kind.',
    );

    expect(findJob(store, "job-2").status).toBe("SUCCEEDED");
  });

  it("keeps draining after one job fails", async () => {
    const store = createFakeJobStore([
      due({ id: "job-1", idempotencyKey: "fails" }),
      due({ id: "job-2", idempotencyKey: "works" }),
    ]);
    const handler: JobHandler = (context) => {
      if (context.job.id === "job-1") throw new Error("channel said no");
    };

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
      limit: 10,
    });

    expect(summary.retried).toBe(1);
    expect(summary.succeeded).toBe(1);

    const failed = findJob(store, "job-1");
    expect(failed.status).toBe("PENDING");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("channel said no");
    expect(failed.runAt.getTime()).toBeGreaterThan(NOW.getTime());

    expect(findJob(store, "job-2").status).toBe("SUCCEEDED");
  });

  it("reschedules a rate-limited job without spending an attempt or retrying it in the same pass", async () => {
    const store = createFakeJobStore([due({ id: "job-1" })]);
    const handler = vi.fn<JobHandler>(() => {
      throw new RateLimitedError("429", 30_000);
    });

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
      limit: 5,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(summary.rateLimited).toBe(1);
    expect(summary.retried).toBe(0);

    const job = findJob(store, "job-1");
    expect(job.attempts).toBe(0);
    expect(job.status).toBe("PENDING");
    expect(job.runAt.getTime()).toBe(NOW.getTime() + 30_000);
  });

  it("counts a job that exhausted its attempts as DEAD", async () => {
    const store = createFakeJobStore([
      due({ id: "job-1", attempts: 4, maxAttempts: 5 }),
    ]);
    const handler = vi.fn<JobHandler>(() => {
      throw new Error("nope");
    });

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(summary.dead).toBe(1);
    expect(summary.outcomes[0].outcome).toBe("dead");
    expect(findJob(store, "job-1").status).toBe("DEAD");
  });

  it("uses the injected clock, so a job scheduled later is untouched", async () => {
    const store = createFakeJobStore([
      due({ id: "job-1", runAt: new Date(NOW.getTime() + 1) }),
    ]);
    const handler = vi.fn<JobHandler>();

    const summary = await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(summary.claimed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
    expect(findJob(store, "job-1").status).toBe("PENDING");
  });

  it("does not run two jobs in parallel when a handler is slow", async () => {
    const store = createFakeJobStore([
      due({ id: "job-1", idempotencyKey: "a" }),
      due({ id: "job-2", idempotencyKey: "b" }),
    ]);
    const order: string[] = [];

    const handler: JobHandler = async (context) => {
      order.push(`start:${context.job.id}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end:${context.job.id}`);
    };

    await drain({
      store,
      registry: registry({ publish: handler }),
      workerId: WORKER,
      now: () => NOW,
    });

    expect(order).toEqual([
      "start:job-1",
      "end:job-1",
      "start:job-2",
      "end:job-2",
    ]);
  });
});

describe("listClaimable", () => {
  it("previews what a drain would claim without writing anything", async () => {
    const store = createFakeJobStore([
      due({
        id: "job-1",
        idempotencyKey: "a",
        runAt: new Date(NOW.getTime() - 2_000),
      }),
      due({
        id: "job-2",
        idempotencyKey: "b",
        runAt: new Date(NOW.getTime() - 1_000),
      }),
      due({
        id: "job-3",
        idempotencyKey: "c",
        runAt: new Date(NOW.getTime() + 1_000),
      }),
      due({ id: "job-4", idempotencyKey: "d", status: "RUNNING" }),
    ]);

    const claimable = await listClaimable(store, { now: NOW, limit: 10 });

    expect(claimable.map((job) => job.id)).toEqual(["job-1", "job-2"]);
    expect(store.calls.every((call) => call.kind === "findMany")).toBe(true);
    expect(store.jobs.every((job) => job.lockedBy === null)).toBe(true);
  });

  it("respects the limit and the lookahead horizon", async () => {
    const store = createFakeJobStore(
      Array.from({ length: 4 }, (_, index) =>
        due({ id: `job-${index + 1}`, idempotencyKey: `k${index}` }),
      ),
    );

    expect(await listClaimable(store, { now: NOW, limit: 2 })).toHaveLength(2);
  });
});
