import { RateLimitedError } from "@/lib/jobs/types";

import type {
  OperationResult,
  PublicationCar,
  PublicationDeps,
  PublicationState,
  PublicationView,
} from "./types";

/**
 * The rules every publication handler shares.
 *
 * Three decisions live here so the five handlers cannot disagree about them:
 *
 * - **What loading means.** A publication that does not exist is a bug in the
 *   caller (a stale payload), not a marketplace failure, so it throws instead of
 *   writing a row that is not there.
 * - **What a 429 means.** Nothing is recorded: the queue reschedules the job
 *   without consuming an attempt, and a `lastError` written here would outlive
 *   the retry that succeeds.
 * - **What a rejection means.** For every idempotent call (read, price write,
 *   pause, close) the error is recorded and re-thrown, so the queue retries and
 *   the panel has a sentence in the meantime. `publish` is the exception and
 *   handles it itself: a create is not idempotent.
 */

/** `lastError` is a column, not a log: an unbounded marketplace body is a bug. */
export const MAX_PUBLICATION_ERROR_LENGTH = 500;

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return message.length <= MAX_PUBLICATION_ERROR_LENGTH
    ? message
    : message.slice(0, MAX_PUBLICATION_ERROR_LENGTH);
}

export async function loadPublication(
  deps: PublicationDeps,
  publicationId: string,
): Promise<PublicationView> {
  const publication = await deps.store.load(publicationId);

  if (publication === null) {
    throw new Error(`The publication ${publicationId} does not exist.`);
  }

  return publication;
}

/**
 * A decision taken on our side failed: the publication is `FAILED` with a
 * sentence and an event, and the marketplace was not called.
 */
export async function failPublication(
  deps: PublicationDeps,
  publication: PublicationView,
  eventKind: string,
  lastError: string,
): Promise<OperationResult> {
  await deps.store.update(publication.id, { state: "FAILED", lastError });
  await deps.store.appendEvent(publication.id, {
    kind: eventKind,
    payload: { message: lastError },
  });

  return { outcome: "failed", state: "FAILED" };
}

/**
 * A failed marketplace call. The error is left to the queue after recording it.
 *
 * The state is deliberately **not** moved to `FAILED`: the remote listing still
 * exists and is whatever it was. `FAILED` is for "we decided not to publish",
 * which is a fact about our side, not about a `500` we will retry.
 */
export async function rejectApiCall(
  deps: PublicationDeps,
  publication: PublicationView,
  eventKind: string,
  error: unknown,
  lastError: string,
): Promise<never> {
  if (error instanceof RateLimitedError) throw error;

  await deps.store.update(publication.id, { lastError });
  await deps.store.appendEvent(publication.id, {
    kind: eventKind,
    payload: { message: lastError },
  });

  throw error;
}

/**
 * "Sold" is an intent, not a field (D1): either signal counts, because the app
 * sets the status and the timestamp together and a row edited by hand may only
 * carry one of them.
 */
export function isSold(car: PublicationCar): boolean {
  return car.status === "SOLD" || car.soldAt !== null;
}

/** Every write that stores a remote status also clears the stale error. */
export function stateAfterRemote(
  current: PublicationState,
  remoteStatus: string | null,
): PublicationState {
  switch (remoteStatus) {
    case "active":
      return "PUBLISHED";
    case "paused":
      return "PAUSED";
    case "closed":
      return "REMOVED";
    default:
      // `under_review`, `payment_required`, `inactive` and anything new ML
      // invents are recorded verbatim and explained by the panel: guessing a
      // state out of an unknown status is how a live listing looks broken.
      return current;
  }
}
