import type { MeliItem } from "../items";
import { publicationMessages } from "./messages";
import {
  describeError,
  failPublication,
  loadPublication,
  rejectApiCall,
  stateAfterRemote,
} from "./support";
import type {
  OperationResult,
  PublicationDeps,
  PublicationState,
} from "./types";

/**
 * Read-only reconciliation (D1 + T10).
 *
 * Two states look like failures and are not:
 *
 * - `paused` with sub-status `picture downloading pending`. ML is still fetching
 *   the URL pictures; the item resumes by itself. Reporting it as an error would
 *   send the agency to "fix" a listing that is resolving on its own.
 * - `under_review` and `payment_required`. They are facts about the listing, not
 *   about our job: they are recorded verbatim so the panel can explain them.
 *
 * What *is* a failure for this feature is a disagreement with the snapshot: the
 * remote price is not the one we last sent, so somebody edited the listing. That
 * moves the publication to `DIVERGED` and carries both values. Closed wins over
 * divergence because a closed item is not for sale anywhere, whatever its price.
 *
 * The status and sub-status are stored as ML sent them. Mapping them onto our
 * state is lossy, and the panel needs the raw pair to tell a pause we caused
 * from one the marketplace did.
 */

export const TRANSIENT_PICTURE_SUB_STATUS = "picture downloading pending";

export async function syncPublication(
  deps: PublicationDeps,
  publicationId: string,
): Promise<OperationResult> {
  const publication = await loadPublication(deps, publicationId);

  if (publication.remoteId === null) {
    return failPublication(
      deps,
      publication,
      "sync-failed",
      publicationMessages.notPublished(),
    );
  }

  const remoteId = publication.remoteId;
  const channel = deps.channelFor(publication.accountId);
  let current: MeliItem;

  try {
    current = await channel.items.getItem(remoteId);
  } catch (error) {
    return rejectApiCall(
      deps,
      publication,
      "sync-failed",
      error,
      publicationMessages.syncRejected(describeError(error)),
    );
  }

  const snapshot = publication.syncedSnapshot;
  const remotePrice = current.price;
  const transient =
    current.status === "paused" &&
    current.subStatus === TRANSIENT_PICTURE_SUB_STATUS;
  const diverged =
    snapshot !== null && remotePrice !== null && remotePrice !== snapshot.price;

  let state: PublicationState;

  if (current.status === "closed") {
    state = "REMOVED";
  } else if (transient) {
    // Recorded, not interpreted: the listing is between states on purpose.
    state = publication.state;
  } else if (diverged) {
    state = "DIVERGED";
  } else {
    state = stateAfterRemote(publication.state, current.status);
  }

  const lastError =
    state === "DIVERGED" &&
    diverged &&
    snapshot !== null &&
    remotePrice !== null
      ? publicationMessages.divergedPrice(remotePrice, snapshot.price)
      : null;

  await deps.store.update(publication.id, {
    state,
    remoteStatus: current.status,
    remoteSubStatus: current.subStatus,
    lastError,
  });

  await deps.store.appendEvent(publication.id, {
    kind: state === "DIVERGED" ? "sync-diverged" : "sync",
    payload: {
      remoteStatus: current.status,
      remoteSubStatus: current.subStatus,
      state,
      ...(diverged && current.price !== null && snapshot !== null
        ? { remotePrice: current.price, snapshotPrice: snapshot.price }
        : {}),
    },
  });

  return { outcome: "synced", state };
}
