/**
 * The durable queue: enqueue, claim, complete, fail, recover, drain.
 *
 * Every decision about *when* or *whether* a job runs lives in this file so it
 * can be pinned by tests against a fake client — no database, no connection
 * string, no marketplace. The one rule that shapes the rest is rule 1: a claim
 * is a compare-and-set, because two drainers exist the moment the queue is
 * worth having.
 *
 * History lives on the `Job` row (`attempts`, `lastError`, timestamps).
 * `PublicationEvent` traces a publication and is written by the publication
 * layer, not by a job transition: a retried job is not a publication event, and
 * repurposing that table would make "what happened to this listing" include
 * "the drainer tried again".
 */

import { nextRunAt, pickJitter, type BackoffPolicy } from "@/lib/jobs/backoff";
import {
  RateLimitedError,
  TERMINAL_JOB_STATUSES,
  type JobContext,
  type JobHandler,
  type JobOrderBy,
  type JobRegistry,
  type JobRow,
  type JobStatus,
  type JobStore,
  type JobUpdateData,
} from "@/lib/jobs/types";

/** `lastError` is a column, not a log: an unbounded message is a storage bug. */
export const MAX_LAST_ERROR_LENGTH = 500;

/** A lock older than this belongs to a drainer that never came back. */
export const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1_000;

export const DEFAULT_DRAIN_LIMIT = 10;

/**
 * How many contested candidates one claim may walk before giving up.
 *
 * Only reached under heavy contention; giving up returns `null`, which ends a
 * drain pass cleanly and leaves the rows for the next one.
 */
const MAX_CLAIM_ROUNDS = 10;

/** Oldest due job first, then oldest row: a stable order for the index. */
const DUE_ORDER: readonly JobOrderBy[] = [
  { runAt: "asc" },
  { createdAt: "asc" },
];

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function truncateLastError(message: string): string {
  return message.length <= MAX_LAST_ERROR_LENGTH
    ? message
    : message.slice(0, MAX_LAST_ERROR_LENGTH);
}

export interface EnqueueInput {
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly payload?: unknown;
  /** Defaults to `now`, which makes the job claimable on the next pass. */
  readonly runAt?: Date;
  readonly maxAttempts?: number;
  readonly now?: Date;
}

/**
 * Rule 2: one row per `idempotencyKey`.
 *
 * Two steps instead of one `upsert` with the reset in `update`, because that
 * reset would also fire on a `RUNNING` row — the one case where reviving a job
 * lets two workers publish the same vehicle. The `upsert` guarantees the row
 * exists (it is the unique key, so a concurrent enqueue cannot create a second
 * one), then a conditional `updateMany` revives it only when it is terminal.
 */
export async function enqueue(
  store: JobStore,
  input: EnqueueInput,
): Promise<JobRow> {
  const now = input.now ?? new Date();
  const runAt = input.runAt ?? now;

  await store.job.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      status: "PENDING",
      attempts: 0,
      runAt,
      ...(input.payload === undefined ? {} : { payload: input.payload }),
      ...(input.maxAttempts === undefined
        ? {}
        : { maxAttempts: input.maxAttempts }),
    },
    // Nothing to change: a PENDING row keeps its attempt count and its
    // scheduled time, and a RUNNING row belongs to whoever holds the lock. The
    // `kind` is rewritten with the value it already has (the key is derived
    // from it) so the update is a no-op that still carries a field: an empty
    // `data` object relies on Prisma accepting a contentless update.
    update: { kind: input.kind },
  });

  const revive: JobUpdateData = {
    status: "PENDING",
    attempts: 0,
    runAt,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
    ...(input.payload === undefined ? {} : { payload: input.payload }),
    ...(input.maxAttempts === undefined
      ? {}
      : { maxAttempts: input.maxAttempts }),
  };

  await store.job.updateMany({
    where: {
      idempotencyKey: input.idempotencyKey,
      status: { in: TERMINAL_JOB_STATUSES },
    },
    data: revive,
  });

  const job = await store.job.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (!job) {
    throw new Error(
      `The job ${input.idempotencyKey} disappeared between the upsert and the read.`,
    );
  }

  return job;
}

export interface ClaimOptions {
  readonly now: Date;
  readonly workerId: string;
}

/**
 * Rule 1: claim by compare-and-set, never read-then-write.
 *
 * `updateMany` with `{ id, status: "PENDING", runAt: { lte: now } }` is a single
 * statement whose `count` decides ownership. Reading a candidate and then
 * updating it by id would let two drainers read the same row and both believe
 * they own it; here the loser sees `count: 0` and moves on to the next
 * candidate. Claimed ids are not retried in the same call, so a contested row
 * cannot make the loop spin on it.
 */
export async function claimNext(
  store: JobStore,
  options: ClaimOptions,
): Promise<JobRow | null> {
  const contested: string[] = [];

  for (let round = 0; round < MAX_CLAIM_ROUNDS; round += 1) {
    const candidate = await store.job.findFirst({
      where: {
        status: "PENDING",
        runAt: { lte: options.now },
        ...(contested.length === 0 ? {} : { id: { notIn: contested } }),
      },
      orderBy: DUE_ORDER,
    });

    if (!candidate) return null;

    const claimed = await store.job.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
        runAt: { lte: options.now },
      },
      data: {
        status: "RUNNING",
        lockedAt: options.now,
        lockedBy: options.workerId,
      },
    });

    if (claimed.count === 1) {
      return {
        ...candidate,
        status: "RUNNING",
        lockedAt: options.now,
        lockedBy: options.workerId,
      };
    }

    contested.push(candidate.id);
  }

  return null;
}

/**
 * The handler resolved: the job is done.
 *
 * Guarded on `RUNNING` so a drainer whose lock was already recovered cannot
 * finish a row another worker now owns. `lastError` is left alone: it is the
 * history of what went wrong, not a field that a later success rewrites.
 */
export async function complete(store: JobStore, job: JobRow): Promise<void> {
  await store.job.updateMany({
    where: { id: job.id, status: "RUNNING" },
    data: { status: "SUCCEEDED", lockedAt: null, lockedBy: null },
  });
}

export interface FailOptions {
  readonly now: Date;
  readonly backoff?: BackoffPolicy;
}

export interface JobFailureOutcome {
  /** False when the row was no longer `RUNNING` and the write was skipped. */
  readonly applied: boolean;
  readonly rateLimited: boolean;
  readonly status: "PENDING" | "DEAD";
  readonly attempts: number;
  readonly runAt: Date;
  readonly lastError: string;
}

/**
 * Rules 3 and 4: what a thrown error means.
 *
 * A `RateLimitedError` is the upstream asking us to wait. The job is healthy,
 * so `attempts` does not move: a 429 must not consume the retry budget,
 * otherwise a busy afternoon kills jobs that never actually failed. When the
 * response carries `retryAfterMs` we honour it, because guessing a longer
 * delay than the server asked for is how a queue stalls.
 *
 * Anything else counts an attempt, stores a truncated message and backs off;
 * at `maxAttempts` the job becomes `DEAD` so the drainer stops paying for it
 * and a human decides.
 */
export async function fail(
  store: JobStore,
  job: JobRow,
  error: unknown,
  options: FailOptions,
): Promise<JobFailureOutcome> {
  const lastError = truncateLastError(describeError(error));
  const rateLimited = error instanceof RateLimitedError;

  if (rateLimited) {
    const retryAfterMs = error.retryAfterMs;
    const runAt =
      retryAfterMs !== undefined && Number.isFinite(retryAfterMs)
        ? new Date(options.now.getTime() + Math.max(0, retryAfterMs))
        : nextRunAt({
            attempts: job.attempts,
            now: options.now,
            ...options.backoff,
          });

    const applied = await store.job.updateMany({
      where: { id: job.id, status: "RUNNING" },
      data: {
        status: "PENDING",
        runAt,
        lockedAt: null,
        lockedBy: null,
        lastError,
      },
    });

    return {
      applied: applied.count === 1,
      rateLimited: true,
      status: "PENDING",
      attempts: job.attempts,
      runAt,
      lastError,
    };
  }

  const attempts = job.attempts + 1;
  const dead = attempts >= job.maxAttempts;
  const runAt = dead
    ? job.runAt
    : nextRunAt({
        attempts: job.attempts,
        now: options.now,
        ...options.backoff,
      });

  const applied = await store.job.updateMany({
    where: { id: job.id, status: "RUNNING" },
    data: dead
      ? { status: "DEAD", attempts, lockedAt: null, lockedBy: null, lastError }
      : {
          status: "PENDING",
          attempts,
          runAt,
          lockedAt: null,
          lockedBy: null,
          lastError,
        },
  });

  return {
    applied: applied.count === 1,
    rateLimited: false,
    status: dead ? "DEAD" : "PENDING",
    attempts,
    runAt,
    lastError,
  };
}

export interface StaleOptions {
  readonly now: Date;
  readonly staleAfterMs?: number;
}

function staleCutoff(options: StaleOptions): Date {
  const staleAfterMs = Math.max(
    0,
    options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
  );
  return new Date(options.now.getTime() - staleAfterMs);
}

/**
 * RUNNING rows whose lock is older than the timeout. Read-only, so the dry run
 * can report exactly what a real pass would recover.
 */
export async function listStale(
  store: JobStore,
  options: StaleOptions,
): Promise<readonly JobRow[]> {
  return store.job.findMany({
    where: { status: "RUNNING", lockedAt: { lt: staleCutoff(options) } },
    orderBy: [{ createdAt: "asc" }],
  });
}

export interface RecoveredJob {
  readonly id: string;
  readonly kind: string;
  readonly status: Extract<JobStatus, "PENDING" | "DEAD">;
  readonly attempts: number;
}

/**
 * Rule 5: a lock nobody released goes back to the queue — and counts.
 *
 * A drainer that dies mid-handler leaves a `RUNNING` row that no other worker
 * may touch. Recovery returns it to `PENDING` with `attempts` incremented, so
 * the attempts the dead drainer never reported are not free: the same
 * `maxAttempts` ceiling that buries a failing job buries a job that keeps
 * killing its worker. Without the increment, a handler with an infinite loop
 * would be recovered and re-run forever.
 *
 * The write is conditional on the same stale filter that selected the row, so
 * two drainers recovering at once cannot double-count an attempt.
 */
export async function recoverStale(
  store: JobStore,
  options: StaleOptions,
): Promise<readonly RecoveredJob[]> {
  const cutoff = staleCutoff(options);
  const stale = await listStale(store, options);
  const recovered: RecoveredJob[] = [];

  for (const job of stale) {
    const attempts = job.attempts + 1;
    const dead = attempts >= job.maxAttempts;

    const applied = await store.job.updateMany({
      where: { id: job.id, status: "RUNNING", lockedAt: { lt: cutoff } },
      data: {
        status: dead ? "DEAD" : "PENDING",
        attempts: { increment: 1 },
        runAt: dead ? job.runAt : options.now,
        lockedAt: null,
        lockedBy: null,
        lastError: dead
          ? truncateLastError(
              `Recovered ${attempts} times from a stale lock: the drainer never reported back.`,
            )
          : job.lastError,
      },
    });

    if (applied.count !== 1) continue;

    recovered.push({
      id: job.id,
      kind: job.kind,
      status: dead ? "DEAD" : "PENDING",
      attempts,
    });
  }

  return recovered;
}

export interface ListClaimableOptions {
  readonly now: Date;
  readonly limit?: number;
}

/** What a drain would claim right now, without claiming it. */
export async function listClaimable(
  store: JobStore,
  options: ListClaimableOptions,
): Promise<readonly JobRow[]> {
  return store.job.findMany({
    where: { status: "PENDING", runAt: { lte: options.now } },
    orderBy: DUE_ORDER,
    take: options.limit ?? DEFAULT_DRAIN_LIMIT,
  });
}

export type DrainJobOutcome =
  | "succeeded"
  | "rate-limited"
  | "retried"
  | "dead"
  | "failed";

export interface DrainJobResult {
  readonly jobId: string;
  readonly kind: string;
  readonly outcome: DrainJobOutcome;
  readonly attempts: number;
  readonly error: string | null;
}

export interface DrainSummary {
  readonly limit: number;
  readonly claimed: number;
  readonly succeeded: number;
  readonly rateLimited: number;
  readonly retried: number;
  readonly dead: number;
  readonly failed: number;
  readonly outcomes: readonly DrainJobResult[];
}

export interface DrainOptions {
  readonly store: JobStore;
  readonly registry: JobRegistry;
  readonly workerId: string;
  /** Injected so a pass has one coherent clock and tests are exact. */
  readonly now?: () => Date;
  readonly limit?: number;
  readonly backoff?: Omit<BackoffPolicy, "jitter">;
  /** Jitter source. Defaults to `Math.random`. */
  readonly random?: () => number;
}

const UNKNOWN_KIND_MESSAGE = (kind: string): string =>
  `No handler is registered for job kind "${kind}". Register one in the drainer or stop enqueueing this kind.`;

/**
 * Rule 6: the loop.
 *
 * Sequential on purpose. The consumer is a marketplace that documents no
 * numeric limit and asks for low concurrency and no bursts, so `drain` runs one
 * job at a time, stops when the claim returns nothing, and never claims more
 * than `limit`. It also stops early when a claim loses every round to another
 * worker, which is not a failure: the rows are still there.
 *
 * A row whose `kind` has no handler is `FAILED` immediately, with a message a
 * human can act on. Retrying it would burn attempts on a configuration
 * mistake, and throwing would take the whole pass down and starve every other
 * job behind it.
 */
export async function drain(options: DrainOptions): Promise<DrainSummary> {
  const limit = Math.max(0, Math.floor(options.limit ?? DEFAULT_DRAIN_LIMIT));
  const clock = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const outcomes: DrainJobResult[] = [];

  while (outcomes.length < limit) {
    const claimed = await claimNext(options.store, {
      now: clock(),
      workerId: options.workerId,
    });

    if (!claimed) break;

    const handler: JobHandler | undefined = options.registry.get(claimed.kind);

    if (!handler) {
      const lastError = UNKNOWN_KIND_MESSAGE(claimed.kind);

      await options.store.job.updateMany({
        where: { id: claimed.id, status: "RUNNING" },
        data: { status: "FAILED", lockedAt: null, lockedBy: null, lastError },
      });

      outcomes.push({
        jobId: claimed.id,
        kind: claimed.kind,
        outcome: "failed",
        attempts: claimed.attempts,
        error: lastError,
      });

      continue;
    }

    const context: JobContext = {
      job: claimed,
      workerId: options.workerId,
      now: clock(),
    };

    try {
      await handler(context);
      await complete(options.store, claimed);

      outcomes.push({
        jobId: claimed.id,
        kind: claimed.kind,
        outcome: "succeeded",
        attempts: claimed.attempts,
        error: null,
      });
    } catch (error) {
      const failure = await fail(options.store, claimed, error, {
        now: clock(),
        backoff: { ...options.backoff, jitter: pickJitter(random) },
      });

      outcomes.push({
        jobId: claimed.id,
        kind: claimed.kind,
        outcome: failure.rateLimited
          ? "rate-limited"
          : failure.status === "DEAD"
            ? "dead"
            : "retried",
        attempts: failure.attempts,
        error: failure.lastError,
      });
    }
  }

  const count = (outcome: DrainJobOutcome): number =>
    outcomes.filter((result) => result.outcome === outcome).length;

  return {
    limit,
    claimed: outcomes.length,
    succeeded: count("succeeded"),
    rateLimited: count("rate-limited"),
    retried: count("retried"),
    dead: count("dead"),
    failed: count("failed"),
    outcomes,
  };
}

/**
 * The drain pass, as lines a person reads.
 *
 * In the engine instead of a script so the two callers — `drain:jobs` and
 * `publications drain` — cannot describe the same pass differently, and so the
 * format is pinned by the type it prints.
 */
export function formatDrainSummary(summary: DrainSummary): string {
  const lines = [
    `Claimed ${summary.claimed} job(s): ${summary.succeeded} succeeded, ${summary.rateLimited} rate-limited, ${summary.retried} retried, ${summary.dead} dead, ${summary.failed} failed.`,
  ];

  for (const outcome of summary.outcomes) {
    const suffix = outcome.error === null ? "" : `  ${outcome.error}`;
    lines.push(
      `  ${outcome.jobId}  ${outcome.kind}  ${outcome.outcome}  attempts=${outcome.attempts}${suffix}`,
    );
  }

  return lines.join("\n");
}
