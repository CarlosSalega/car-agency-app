import type {
  JobCreateData,
  JobOrderBy,
  JobRow,
  JobStatus,
  JobStore,
  JobUpdateData,
  JobWhere,
} from "@/lib/jobs/types";

/**
 * An in-memory `JobStore` with the fragment of Prisma's semantics the engine
 * uses: `upsert` on the unique key, filtered `updateMany`, and ordering.
 *
 * It is a fake on purpose. Every rule the queue implements is a decision about
 * what to write, so the rules are pinned here without a database, a connection
 * string or a container. The one behaviour the fake has to reproduce exactly is
 * the compare-and-set: `claimConflicts` makes `updateMany` report `count: 0`
 * for a row another drainer already won, which is the race rule 1 exists for.
 */

const DEFAULT_NOW = new Date("2026-01-01T00:00:00.000Z");

export type SeedJob = Partial<JobRow> & {
  readonly kind: string;
  readonly idempotencyKey: string;
};

export type RecordedCall =
  | {
      readonly kind: "upsert";
      readonly where: { readonly idempotencyKey: string };
      readonly create: JobCreateData;
      readonly update: JobUpdateData;
    }
  | {
      readonly kind: "findFirst" | "findMany" | "findUnique";
      readonly where: JobWhere;
    }
  | {
      readonly kind: "updateMany";
      readonly where: JobWhere;
      readonly data: JobUpdateData;
    };

export interface FakeJobStore extends JobStore {
  readonly jobs: JobRow[];
  readonly calls: RecordedCall[];
  /** Simulate a concurrent drainer winning the claim for these ids. */
  readonly claimConflicts: Set<string>;
}

let sequence = 0;

function buildJob(seed: SeedJob): JobRow {
  sequence += 1;
  const createdAt = seed.createdAt ?? DEFAULT_NOW;

  return {
    id: seed.id ?? `job-${sequence}`,
    kind: seed.kind,
    idempotencyKey: seed.idempotencyKey,
    payload: seed.payload ?? null,
    status: seed.status ?? "PENDING",
    attempts: seed.attempts ?? 0,
    maxAttempts: seed.maxAttempts ?? 5,
    runAt: seed.runAt ?? createdAt,
    lockedAt: seed.lockedAt ?? null,
    lockedBy: seed.lockedBy ?? null,
    lastError: seed.lastError ?? null,
    createdAt,
    updatedAt: seed.updatedAt ?? createdAt,
  };
}

function matchRunAt(
  runAt: Date,
  filter: NonNullable<JobWhere["runAt"]>,
): boolean {
  const time = runAt.getTime();
  if (filter.lte !== undefined && time > filter.lte.getTime()) return false;
  if (filter.lt !== undefined && time >= filter.lt.getTime()) return false;
  return true;
}

function matches(job: JobRow, where: JobWhere): boolean {
  if (where.id !== undefined) {
    if (typeof where.id === "string") {
      if (job.id !== where.id) return false;
    } else if (where.id.notIn.includes(job.id)) {
      return false;
    }
  }

  if (
    where.idempotencyKey !== undefined &&
    job.idempotencyKey !== where.idempotencyKey
  ) {
    return false;
  }

  if (where.kind !== undefined && job.kind !== where.kind) return false;

  if (where.status !== undefined) {
    if (typeof where.status === "string") {
      if (job.status !== where.status) return false;
    } else if (!where.status.in.includes(job.status)) {
      return false;
    }
  }

  if (where.runAt !== undefined && !matchRunAt(job.runAt, where.runAt))
    return false;

  if (where.lockedAt?.lt !== undefined) {
    if (job.lockedAt === null) return false;
    if (job.lockedAt.getTime() >= where.lockedAt.lt.getTime()) return false;
  }

  return true;
}

function applyUpdate(job: JobRow, data: JobUpdateData): JobRow {
  const attempts =
    data.attempts === undefined
      ? job.attempts
      : typeof data.attempts === "number"
        ? data.attempts
        : job.attempts + data.attempts.increment;

  return {
    ...job,
    kind: data.kind ?? job.kind,
    payload: data.payload === undefined ? job.payload : data.payload,
    status: (data.status ?? job.status) as JobStatus,
    attempts,
    maxAttempts: data.maxAttempts ?? job.maxAttempts,
    runAt: data.runAt ?? job.runAt,
    lockedAt: data.lockedAt === undefined ? job.lockedAt : data.lockedAt,
    lockedBy: data.lockedBy === undefined ? job.lockedBy : data.lockedBy,
    lastError: data.lastError === undefined ? job.lastError : data.lastError,
  };
}

function sortJobs(
  jobs: readonly JobRow[],
  order: JobOrderBy | readonly JobOrderBy[],
): JobRow[] {
  const clauses = Array.isArray(order) ? order : [order as JobOrderBy];

  return [...jobs].sort((left, right) => {
    for (const clause of clauses) {
      if (clause.runAt !== undefined) {
        const delta = left.runAt.getTime() - right.runAt.getTime();
        if (delta !== 0) return clause.runAt === "asc" ? delta : -delta;
      }
      if (clause.createdAt !== undefined) {
        const delta = left.createdAt.getTime() - right.createdAt.getTime();
        if (delta !== 0) return clause.createdAt === "asc" ? delta : -delta;
      }
    }
    return 0;
  });
}

export function createFakeJobStore(
  seeds: readonly SeedJob[] = [],
): FakeJobStore {
  const jobs: JobRow[] = seeds.map(buildJob);
  const calls: RecordedCall[] = [];
  const claimConflicts = new Set<string>();

  return {
    jobs,
    calls,
    claimConflicts,

    job: {
      async findUnique({ where }) {
        calls.push({ kind: "findUnique", where });

        return (
          jobs.find((job) => job.idempotencyKey === where.idempotencyKey) ??
          null
        );
      },

      async findFirst({ where, orderBy }) {
        calls.push({ kind: "findFirst", where });

        const found = jobs.filter((job) => matches(job, where));

        return (orderBy ? sortJobs(found, orderBy) : found)[0] ?? null;
      },

      async findMany({ where, orderBy, take }) {
        calls.push({ kind: "findMany", where });

        const found = jobs.filter((job) => matches(job, where));
        const ordered = orderBy ? sortJobs(found, orderBy) : found;

        return take === undefined ? ordered : ordered.slice(0, take);
      },

      async updateMany({ where, data }) {
        calls.push({ kind: "updateMany", where, data });

        // The compare-and-set losing the race: another drainer moved the row
        // after this one selected it, so the guarded update matches nothing.
        if (typeof where.id === "string" && claimConflicts.has(where.id)) {
          return { count: 0 };
        }

        let count = 0;

        for (const [index, job] of jobs.entries()) {
          if (!matches(job, where)) continue;
          jobs[index] = applyUpdate(job, data);
          count += 1;
        }

        return { count };
      },

      async upsert({ where, create, update }) {
        calls.push({ kind: "upsert", where, create, update });

        const existing = jobs.find(
          (job) => job.idempotencyKey === where.idempotencyKey,
        );

        if (existing) {
          const updated = applyUpdate(existing, update);
          jobs[jobs.indexOf(existing)] = updated;
          return updated;
        }

        const created = applyUpdate(
          buildJob({
            kind: create.kind,
            idempotencyKey: create.idempotencyKey,
          }),
          create,
        );
        jobs.push(created);
        return created;
      },
    },
  };
}

export function findJob(store: FakeJobStore, id: string): JobRow {
  const job = store.jobs.find((candidate) => candidate.id === id);
  if (!job) throw new Error(`No job ${id} in the fake store`);
  return job;
}
