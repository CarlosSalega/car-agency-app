import { unstable_cache } from "next/cache";

import { CACHE_REVALIDATE, CACHE_TAGS } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { prismaSafe } from "@/lib/prisma-safe";

/**
 * What the landing is allowed to see.
 *
 * `isPublished` is the whole point of the model: a testimonial is loaded before
 * it is shown, and the public query is the only thing standing between a
 * half-written row and a visitor. It is a `where` here, not a filter in the
 * component, so no future surface can forget it.
 */

/**
 * The fields a card renders. No `isPublished` outside the `where`, and no
 * `createdAt`/`updatedAt`: not needed.
 *
 * `reviewedAt` is an **ISO string**, not a `Date`, and that is not sloppiness.
 * `unstable_cache` serializes its result to JSON, so a `Date` declared in the type
 * comes back as a string at runtime — this shipped a 500 the first time because
 * the JSON-LD called `.toISOString()` on it. The boundary is typed for what it
 * actually returns, and the formatter accepts both shapes.
 */
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  reviewedAt: string;
  photoPath: string | null;
  sortOrder: number;
}

export interface PublishedReviewSummary {
  count: number;
  /** Mean rating to one decimal, computed from the published rows only. */
  average: number;
}

const PUBLIC_REVIEW_FIELDS = {
  id: true,
  authorName: true,
  rating: true,
  text: true,
  reviewedAt: true,
  photoPath: true,
  sortOrder: true,
} as const;

/**
 * Published testimonials, in display order.
 *
 * Cached and tagged `reviews`: the landing is rendered per request and this read
 * would otherwise hit the database on every visit. Every admin write calls
 * `revalidateReviews()`.
 */
export const getPublishedReviews = unstable_cache(
  async (): Promise<PublicReview[]> => {
    const rows = await prismaSafe(() =>
      prisma.review.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { reviewedAt: "desc" }],
        select: PUBLIC_REVIEW_FIELDS,
      }),
    );

    // Serialized here, on purpose: whatever crosses the cache is plain JSON.
    return rows.map((row) => ({
      ...row,
      reviewedAt: row.reviewedAt.toISOString(),
    }));
  },
  [CACHE_TAGS.REVIEWS, "published-reviews"],
  {
    tags: [CACHE_TAGS.REVIEWS],
    revalidate: CACHE_REVALIDATE.DYNAMIC_DATA,
  },
);

/**
 * The aggregate the JSON-LD publishes, derived from what the page actually
 * shows.
 *
 * `null` when nothing is published, and the caller must then emit no
 * `aggregateRating` at all. Emitting zero reviews, or the hand-typed 4.9/249 that
 * used to live in the page, is exactly what Google's structured data policy
 * calls a self-serving rating.
 *
 * Only `rating` is selected: the summary has no business reading the text of a
 * customer's review to compute a mean.
 */
export const getPublishedReviewSummary = unstable_cache(
  async (): Promise<PublishedReviewSummary | null> => {
    const rows = await prismaSafe(() =>
      prisma.review.findMany({
        where: { isPublished: true },
        select: { rating: true },
      }),
    );

    if (rows.length === 0) return null;

    const total = rows.reduce((sum, row) => sum + row.rating, 0);

    return {
      count: rows.length,
      average: Math.round((total / rows.length) * 10) / 10,
    };
  },
  [CACHE_TAGS.REVIEWS, "published-review-summary"],
  {
    tags: [CACHE_TAGS.REVIEWS],
    revalidate: CACHE_REVALIDATE.DYNAMIC_DATA,
  },
);
