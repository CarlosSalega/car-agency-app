import type {
  PublicReview,
  PublishedReviewSummary,
} from "@/lib/queries/reviews";

/**
 * Wires the published testimonials into the landing's `AutoDealer` structured
 * data.
 *
 * Pure on purpose: this is the part of the feature that talks to Google, and it
 * has to be testable without a database, a render, or a network. The caller reads
 * the rows; this function decides what may be claimed.
 *
 * The two rules:
 *
 * 1. **No rows, no rating.** Emitting `aggregateRating` with zero reviews, or with
 *    numbers typed in by hand, is a self-serving rating under Google's policy.
 *    Absent is the correct answer.
 * 2. **Only the fields a review is** — author, rating, date, body. The panel's
 *    `isPublished` and `sortOrder` are internal bookkeeping and never ship.
 */

export interface ReviewStructuredDataInput {
  summary: PublishedReviewSummary | null;
  reviews: PublicReview[];
}

/**
 * `YYYY-MM-DD`: schema.org accepts a date, not a timestamp with a timezone.
 *
 * Accepts the ISO string the cached read returns; the first ten characters of an
 * ISO instant are already the UTC date.
 */
function isoDate(date: Date | string): string {
  return (date instanceof Date ? date.toISOString() : date).slice(0, 10);
}

export function withReviewStructuredData<T extends Record<string, unknown>>(
  dealer: T,
  { summary, reviews }: ReviewStructuredDataInput,
): T & Record<string, unknown> {
  if (!summary || reviews.length === 0) return { ...dealer };

  return {
    ...dealer,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.average,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorName },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      datePublished: isoDate(review.reviewedAt),
      reviewBody: review.text,
    })),
  };
}
