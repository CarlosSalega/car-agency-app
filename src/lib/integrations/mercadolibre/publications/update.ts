import type { MeliItem } from "../items";
import { publicationMessages } from "./messages";
import { closeRemoteItem } from "./pause-close";
import {
  describeError,
  failPublication,
  isSold,
  loadPublication,
  rejectApiCall,
} from "./support";
import type {
  OperationResult,
  PublicationContext,
  PublicationDeps,
  PublicationSnapshot,
} from "./types";

/**
 * Push the price, or hand the disagreement to a human (D1).
 *
 * The snapshot is the whole mechanism. If Mercado Libre holds a price other
 * than the one we last sent, somebody edited the listing — usually standing
 * next to the car — and silently reverting that destroys trust the first time
 * it happens. So the handler writes nothing and moves to `DIVERGED` with both
 * values. If the remote price is what we sent and our own price moved, pushing
 * is safe because nobody else touched it.
 *
 * "Sold" is checked first and closes unconditionally: an intent is not a field,
 * so a sold vehicle is never a divergence to resolve.
 */
export async function updatePublication(
  deps: PublicationDeps,
  publicationId: string,
  context: PublicationContext,
): Promise<OperationResult> {
  const publication = await loadPublication(deps, publicationId);

  if (publication.remoteId === null) {
    return failPublication(
      deps,
      publication,
      "update-failed",
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
      "update-failed",
      error,
      publicationMessages.updateRejected(describeError(error)),
    );
  }

  if (isSold(publication.car)) {
    return closeRemoteItem({
      deps,
      publication,
      channel,
      current,
      eventKind: "sold-close",
      outcome: "sold-closed",
    });
  }

  const snapshot = publication.syncedSnapshot;

  if (
    snapshot !== null &&
    current.price !== null &&
    current.price !== snapshot.price
  ) {
    const lastError = publicationMessages.divergedPrice(
      current.price,
      snapshot.price,
    );

    await deps.store.update(publication.id, {
      state: "DIVERGED",
      lastError,
      remoteStatus: current.status,
      remoteSubStatus: current.subStatus,
    });
    await deps.store.appendEvent(publication.id, {
      kind: "diverged",
      payload: {
        remotePrice: current.price,
        snapshotPrice: snapshot.price,
      },
    });

    return { outcome: "diverged", state: "DIVERGED" };
  }

  // Nothing of ours moved: do not write a listing that is already right.
  if (snapshot !== null && publication.car.price === snapshot.price) {
    return { outcome: "unchanged", state: publication.state };
  }

  let updated: MeliItem;

  try {
    updated = await channel.items.updateItem(remoteId, {
      price: publication.car.price,
    });
  } catch (error) {
    return rejectApiCall(
      deps,
      publication,
      "update-failed",
      error,
      publicationMessages.updateRejected(describeError(error)),
    );
  }

  const nextSnapshot: PublicationSnapshot = {
    price: publication.car.price,
    // The title was not sent, so the last one we sent is still the snapshot's.
    title: snapshot?.title ?? publication.car.title,
    status: updated.status ?? snapshot?.status ?? null,
    pictureCount: snapshot?.pictureCount ?? publication.car.images.length,
  };

  await deps.store.update(publication.id, {
    state: "PUBLISHED",
    remoteStatus: updated.status ?? current.status,
    remoteSubStatus: updated.subStatus,
    syncedSnapshot: nextSnapshot,
    syncedAt: context.now,
    lastError: null,
  });

  await deps.store.appendEvent(publication.id, {
    kind: "price-update",
    payload: {
      remoteId,
      price: nextSnapshot.price,
      previousPrice: snapshot?.price ?? null,
    },
  });

  return { outcome: "price-updated", state: "PUBLISHED" };
}
