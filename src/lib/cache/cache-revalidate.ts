import { revalidateTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache";

/**
 * Next.js 16 made the second `revalidateTag` argument required.
 *
 * The previous single-argument call was documented as equivalent to
 * `{ expire: 0 }`: stale content is never served and the next request blocks
 * until the revalidation completes. `{ expire: 0 }` is used here to preserve
 * that behavior exactly.
 *
 * `profile: "max"` is the recommended value in the Next.js docs, but it is
 * deliberately NOT used. It switches to stale-while-revalidate and would serve
 * stale content for up to a year while revalidating in the background, so an
 * admin who just created a vehicle would not see it. That is a behavior change,
 * not a migration.
 *
 * `updateTag` is not an option: it can only be called from a Server Action, and
 * every caller of these helpers is a Route Handler under `src/app/api`.
 */
const IMMEDIATE = { expire: 0 } as const;

export function revalidateCars() {
  revalidateTag(CACHE_TAGS.CARS, IMMEDIATE);
}

export function revalidateCar(id: string) {
  revalidateTag(CACHE_TAGS.CAR(id), IMMEDIATE);
}

export function revalidateBrands() {
  revalidateTag(CACHE_TAGS.BRANDS, IMMEDIATE);
}

export function revalidateModels() {
  revalidateTag(CACHE_TAGS.MODELS, IMMEDIATE);
}

export function revalidateSellers() {
  revalidateTag(CACHE_TAGS.SELLERS, IMMEDIATE);
}

/**
 * Reviews are read by the landing and by the `aggregateRating` in its JSON-LD, so
 * publishing one changes both a card and a number Google reads. Both reads share
 * the tag, so a single call is enough.
 */
export function revalidateReviews() {
  revalidateTag(CACHE_TAGS.REVIEWS, IMMEDIATE);
}
