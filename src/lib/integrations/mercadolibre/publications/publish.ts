import { RateLimitedError } from "@/lib/jobs/types";

import { buildAttributes } from "../attributes";
import type { MeliItem } from "../items";
import { publicationMessages } from "./messages";
import { describeError, failPublication, loadPublication } from "./support";
import type {
  OperationResult,
  PublicationContext,
  PublicationDeps,
  PublicationSnapshot,
} from "./types";

/**
 * Create the listing, or refuse before the marketplace sees it.
 *
 * The order is the whole design: predict the category, resolve the required
 * attributes, build the picture list, and only then call `POST /items`. Every
 * failure before the call is a sentence in `lastError` naming what is missing;
 * a failure after it is a `400` that teaches nobody anything (T6, T10).
 *
 * Two further rules:
 *
 * - **A delivery with `remoteId` is a no-op.** The queue can hand the same job
 *   over twice after a stale-lock recovery, and a second listing costs the
 *   agency money and a manual cleanup.
 * - **A rejected create is not retried by the queue.** ML has no idempotency
 *   key for item creation, so a `500` or a timeout may or may not have created
 *   the item. The publication is marked `FAILED` for a human to check instead of
 *   risking a duplicate; only a `429`, which never creates anything, is
 *   re-thrown for the queue to reschedule.
 *
 * `PUBLISHING` is written before the call so an interrupted publish is visible
 * as "in flight" rather than as a publication that looks untouched.
 */
export async function publishPublication(
  deps: PublicationDeps,
  publicationId: string,
  context: PublicationContext,
): Promise<OperationResult> {
  const publication = await loadPublication(deps, publicationId);

  if (publication.remoteId !== null) {
    return { outcome: "already-published", state: publication.state };
  }

  const channel = deps.channelFor(publication.accountId);

  const prediction = await channel.catalog.predictCategory({
    title: publication.car.title,
    site: publication.account.siteId,
  });

  if (prediction === null) {
    return failPublication(
      deps,
      publication,
      "create-failed",
      publicationMessages.categoryNotPredicted(publication.car.title),
    );
  }

  const required = await channel.catalog.getRequiredAttributes(
    prediction.categoryId,
  );
  const built = buildAttributes({
    car: publication.car,
    brandName: publication.car.brandName,
    modelName: publication.car.modelName,
    required,
  });

  if (built.missing.length > 0) {
    return failPublication(
      deps,
      publication,
      "create-failed",
      publicationMessages.missingAttributes(built.missing),
    );
  }

  // `detail` is 800×600: above ML's 500 px minimum, inside its 1920 px maximum.
  // The 1200×1200 marketplace variant is T7 and does not exist yet.
  const pictureUrls = publication.car.images
    .map((key) => deps.resolveImageUrl(key, "marketplace"))
    .filter((url) => url.trim() !== "");

  if (pictureUrls.length === 0) {
    return failPublication(
      deps,
      publication,
      "create-failed",
      publicationMessages.noPictures(),
    );
  }

  await deps.store.update(publication.id, {
    state: "PUBLISHING",
    lastError: null,
  });
  await deps.store.appendEvent(publication.id, {
    kind: "create-started",
    payload: {
      categoryId: prediction.categoryId,
      pictureCount: pictureUrls.length,
    },
  });

  let item: MeliItem;

  try {
    item = await channel.items.createItem({
      title: publication.car.title,
      categoryId: prediction.categoryId,
      price: publication.car.price,
      currencyId: publication.car.currency,
      pictureUrls,
      attributes: built.attributes,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) throw error;

    return failPublication(
      deps,
      publication,
      "create-failed",
      publicationMessages.createRejected(describeError(error)),
    );
  }

  const snapshot: PublicationSnapshot = {
    price: publication.car.price,
    title: publication.car.title,
    status: item.status,
    pictureCount: pictureUrls.length,
  };

  await deps.store.update(publication.id, {
    state: "PUBLISHED",
    remoteId: item.id,
    remoteStatus: item.status,
    remoteSubStatus: item.subStatus,
    syncedSnapshot: snapshot,
    syncedAt: context.now,
    lastError: null,
  });

  await deps.store.appendEvent(publication.id, {
    kind: "create",
    payload: {
      remoteId: item.id,
      status: item.status,
      price: snapshot.price,
      pictureCount: snapshot.pictureCount,
    },
  });

  return { outcome: "published", state: "PUBLISHED" };
}
