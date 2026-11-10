/**
 * The vocabulary of the job queue.
 *
 * Types live here so the decisions stay pure: `backoff.ts` and
 * `idempotency.ts` import nothing, and `queue.ts` only needs a client shaped
 * like Prisma's `Job` delegate. That shape is declared here, not imported from
 * the generated client, so the queue can be exercised with a fake while the
 * migrations stay unapplied.
 */

/**
 * The operations this feature queues (T9 feeds T5–T8).
 *
 * `publish` creates the remote record, `update` pushes our fields onto it,
 * `pause` stops it temporarily and `close` is the sold cascade. They are
 * separate kinds because they have different handlers and different failure
 * meaning: a failed update is a stale listing, a failed close is a vehicle that
 * is still for sale somewhere. `sync` is the read-only reconciliation: it
 * reads the remote item and records what it found.
 */
export type JobKind = "publish" | "update" | "pause" | "close" | "sync";

/** Every kind the engine knows. A drained row with anything else is a bug. */
export const JOB_KINDS: readonly JobKind[] = [
  "publish",
  "update",
  "pause",
  "close",
  "sync",
];

/** Mirrors the `JobStatus` enum in `prisma/schema.prisma`. */
export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD";

/**
 * Statuses a drainer never touches.
 *
 * Enqueueing a key whose row is terminal revives it; enqueueing one that is
 * `PENDING` or `RUNNING` leaves it alone, because resetting a running job is
 * how the same vehicle gets published twice.
 */
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "DEAD",
];

/**
 * One row of the `Job` table, as the engine reads it.
 *
 * A plain data shape: the generated Prisma model is assignable to it, and so
 * is a hand-built object in a test.
 */
export interface JobRow {
  readonly id: string;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly payload: unknown;
  readonly status: JobStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly runAt: Date;
  readonly lockedAt: Date | null;
  readonly lockedBy: string | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * What a handler is handed.
 *
 * `now` is the clock the drainer was given, not `new Date()`: a handler that
 * records a timestamp must agree with the engine that scheduled it.
 */
export interface JobContext {
  readonly job: JobRow;
  readonly workerId: string;
  readonly now: Date;
}

/**
 * The work itself.
 *
 * Resolving means the job is done. Throwing means it is not: a
 * `RateLimitedError` reschedules without counting an attempt, anything else
 * counts one and backs off (rule 3 and rule 4 in `queue.ts`). A handler must be
 * idempotent — the same row can be delivered again after a stale-lock recovery.
 */
export type JobHandler = (context: JobContext) => Promise<void> | void;

/**
 * Kind → handler. A `Map`, not an object, so a row whose `kind` happens to be
 * `constructor` or `__proto__` cannot resolve to something inherited.
 */
export type JobRegistry = ReadonlyMap<string, JobHandler>;

/**
 * The upstream asked us to slow down; this is not a job failure.
 *
 * MercadoLibre publishes no numeric limit, only `429` plus "back off with
 * jitter" guidance, so the usual case is a bare throw. `retryAfterMs` carries
 * the value when the response has one.
 */
export class RateLimitedError extends Error {
  readonly retryAfterMs: number | undefined;

  constructor(
    message = "The upstream channel rate-limited this job",
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** The subset of `Job` filters the engine uses. */
export interface JobWhere {
  readonly id?: string | { readonly notIn: readonly string[] };
  readonly idempotencyKey?: string;
  readonly kind?: string;
  readonly status?: JobStatus | { readonly in: readonly JobStatus[] };
  readonly runAt?: { readonly lte?: Date; readonly lt?: Date };
  readonly lockedAt?: { readonly lt?: Date };
}

export interface JobOrderBy {
  readonly runAt?: "asc" | "desc";
  readonly createdAt?: "asc" | "desc";
}

export interface JobCreateData {
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly payload?: unknown;
  readonly status?: JobStatus;
  readonly attempts?: number;
  readonly maxAttempts?: number;
  readonly runAt: Date;
}

export interface JobUpdateData {
  readonly kind?: string;
  readonly payload?: unknown;
  readonly status?: JobStatus;
  readonly attempts?: number | { readonly increment: number };
  readonly maxAttempts?: number;
  readonly runAt?: Date;
  readonly lockedAt?: Date | null;
  readonly lockedBy?: string | null;
  readonly lastError?: string | null;
}

/**
 * A client shaped like Prisma's `Job` delegate.
 *
 * Deliberately narrow: every method here is one the engine actually calls, so
 * the fake in `__tests__/fake-job-store.ts` cannot drift into a second
 * implementation of Prisma.
 */
export interface JobStore {
  readonly job: {
    findUnique(args: {
      readonly where: { readonly idempotencyKey: string };
    }): Promise<JobRow | null>;
    findFirst(args: {
      readonly where: JobWhere;
      readonly orderBy?: JobOrderBy | readonly JobOrderBy[];
    }): Promise<JobRow | null>;
    findMany(args: {
      readonly where: JobWhere;
      readonly orderBy?: JobOrderBy | readonly JobOrderBy[];
      readonly take?: number;
    }): Promise<JobRow[]>;
    updateMany(args: {
      readonly where: JobWhere;
      readonly data: JobUpdateData;
    }): Promise<{ readonly count: number }>;
    upsert(args: {
      readonly where: { readonly idempotencyKey: string };
      readonly create: JobCreateData;
      readonly update: JobUpdateData;
    }): Promise<JobRow>;
  };
}
