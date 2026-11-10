import type {
  JobContext,
  JobHandler,
  JobKind,
  JobRegistry,
} from "@/lib/jobs/types";

import { closePublication, pausePublication } from "./pause-close";
import { publishPublication } from "./publish";
import { syncPublication } from "./sync";
import { updatePublication } from "./update";
import type { PublicationDeps, PublicationRunner } from "./types";

/**
 * Kind → handler, exhaustive by type.
 *
 * `Record<JobKind, …>` is the point: adding a kind to the queue without giving
 * it a handler becomes a compile error instead of a `FAILED` row at runtime, and
 * that is exactly the failure mode `scripts/drain-jobs.ts` shipped with (an
 * empty registry).
 *
 * Nothing here imports `@/lib/db`. The registry takes its collaborators
 * injected, so the wiring that needs a database and the environment lives in
 * `runtime.ts` and these rules stay testable without either.
 */

const RUNNERS: Readonly<Record<JobKind, PublicationRunner>> = {
  publish: publishPublication,
  update: updatePublication,
  pause: pausePublication,
  close: closePublication,
  sync: syncPublication,
};

/** The payload every publication job carries: which row to act on. */
export interface PublicationJobPayload {
  readonly publicationId: string;
}

/**
 * The publication id, or a loud failure.
 *
 * A payload without it is a producer bug. Guessing (the car id, the first
 * publication) would act on the wrong listing, which is worse than a job that
 * fails and says why.
 */
export function parsePublicationJobPayload(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw new Error(
      "A publication job needs a publicationId in its payload; the payload is not an object.",
    );
  }

  const { publicationId } = payload as Record<string, unknown>;

  if (typeof publicationId !== "string" || publicationId.trim() === "") {
    throw new Error(
      "A publication job needs a non-empty publicationId in its payload.",
    );
  }

  return publicationId;
}

/**
 * The registry the drainer uses, for every kind the queue knows.
 *
 * The handler's return value describes what happened, which the queue does not
 * need (resolving means success) but a test and a future panel do. It is
 * discarded here on purpose: `JobHandler` returns `void`.
 */
export function createMeliJobRegistry(deps: PublicationDeps): JobRegistry {
  const registry = new Map<string, JobHandler>();

  for (const [kind, run] of Object.entries(RUNNERS)) {
    registry.set(kind, async (context: JobContext) => {
      const publicationId = parsePublicationJobPayload(context.job.payload);

      await run(deps, publicationId, { now: context.now });
    });
  }

  return registry;
}

export { closePublication, pausePublication, publishPublication };
export { syncPublication, updatePublication };
export type * from "./types";
