import type { MeliItem } from "../items";
import { publicationMessages } from "./messages";
import {
  describeError,
  failPublication,
  loadPublication,
  rejectApiCall,
} from "./support";
import type {
  OperationResult,
  PublicationChannel,
  PublicationDeps,
  PublicationView,
} from "./types";

/**
 * `pause` and `close`, which are the same write with two statuses.
 *
 * Both map to `PUT /items/{id}` with `{"status": ...}`. A close is final on ML
 * but an item can be relisted, which produces a **new item id** — so this
 * module never invents one, it stores what the marketplace answered.
 *
 * A close on an already-closed item is success, not an error: the same vehicle
 * can be queued for the sold cascade twice, and telling a person that "closing
 * a closed listing failed" would send them to fix nothing. The item is read
 * first precisely so that case costs no write and no marketplace call.
 */

export interface CloseRemoteItemOptions {
  readonly deps: PublicationDeps;
  readonly publication: PublicationView;
  readonly channel: PublicationChannel;
  readonly current: MeliItem;
  readonly eventKind: "close" | "sold-close";
  readonly outcome: "closed" | "sold-closed";
}

/** Shared by `close` and the sold cascade in `update`, so both stay identical. */
export async function closeRemoteItem({
  deps,
  publication,
  channel,
  current,
  eventKind,
  outcome,
}: CloseRemoteItemOptions): Promise<OperationResult> {
  const remoteId = publication.remoteId;

  if (remoteId === null) {
    return failPublication(
      deps,
      publication,
      eventKind === "close" ? "close-failed" : "sold-close-failed",
      publicationMessages.notPublished(),
    );
  }

  let closed: MeliItem = current;

  if (current.status !== "closed") {
    try {
      closed = await channel.items.updateItem(remoteId, { status: "closed" });
    } catch (error) {
      return rejectApiCall(
        deps,
        publication,
        eventKind === "close" ? "close-failed" : "sold-close-failed",
        error,
        publicationMessages.closeRejected(describeError(error)),
      );
    }
  }

  await deps.store.update(publication.id, {
    state: "REMOVED",
    remoteStatus: closed.status ?? "closed",
    remoteSubStatus: closed.subStatus,
    lastError: null,
  });

  await deps.store.appendEvent(publication.id, {
    kind: eventKind,
    payload: {
      remoteId,
      status: closed.status ?? "closed",
      alreadyClosed: current.status === "closed",
    },
  });

  return { outcome, state: "REMOVED" };
}

export async function pausePublication(
  deps: PublicationDeps,
  publicationId: string,
): Promise<OperationResult> {
  const publication = await loadPublication(deps, publicationId);

  if (publication.remoteId === null) {
    return failPublication(
      deps,
      publication,
      "pause-failed",
      publicationMessages.notPublished(),
    );
  }

  const remoteId = publication.remoteId;
  const channel = deps.channelFor(publication.accountId);
  let paused: MeliItem;

  try {
    paused = await channel.items.updateItem(remoteId, { status: "paused" });
  } catch (error) {
    return rejectApiCall(
      deps,
      publication,
      "pause-failed",
      error,
      publicationMessages.pauseRejected(describeError(error)),
    );
  }

  await deps.store.update(publication.id, {
    state: "PAUSED",
    remoteStatus: paused.status ?? "paused",
    remoteSubStatus: paused.subStatus,
    lastError: null,
  });

  await deps.store.appendEvent(publication.id, {
    kind: "pause",
    payload: { remoteId, status: paused.status ?? "paused" },
  });

  return { outcome: "paused", state: "PAUSED" };
}

export async function closePublication(
  deps: PublicationDeps,
  publicationId: string,
): Promise<OperationResult> {
  const publication = await loadPublication(deps, publicationId);

  if (publication.remoteId === null) {
    return failPublication(
      deps,
      publication,
      "close-failed",
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
      "close-failed",
      error,
      publicationMessages.closeRejected(describeError(error)),
    );
  }

  return closeRemoteItem({
    deps,
    publication,
    channel,
    current,
    eventKind: "close",
    outcome: "closed",
  });
}
