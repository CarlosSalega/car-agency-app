import {
  getPublishedReviewSummary,
  getPublishedReviews,
} from "@/lib/queries/reviews";

import { ReviewsQuote } from "./reviews/reviews-quote";

/**
 * The testimonials section, read from the database.
 *
 * Three decisions survive from the previous version because they were right:
 *
 * 1. **Only published rows, and nothing at all when there are none.** A heading
 *    that promises proof and then renders an empty box is worse than no section.
 * 2. **The aggregate is plain text, never structured data.** The
 *    `aggregateRating` Google reads comes from the published rows in the landing
 *    JSON-LD; turning this badge into markup is exactly what got it removed
 *    before.
 * 3. **The numbers describe something.** They come from
 *    `getPublishedReviewSummary` — the same read the JSON-LD uses — so the badge
 *    and the markup cannot disagree. They used to be literals: the previous
 *    client's real 5.0 from six reviews, which any deployment that published one
 *    testimonial would have claimed as its own.
 *
 * What changed is the shape: one large quote instead of six cards, and the names
 * on the side as a list you can click.
 */
export default async function Reviews() {
  const [reviews, summary] = await Promise.all([
    getPublishedReviews(),
    getPublishedReviewSummary(),
  ]);

  if (reviews.length === 0) return null;

  return (
    <section
      id="resenas"
      className="bg-background border-border scroll-mt-[88px] border-b py-20"
    >
      <div className="mx-auto w-full max-w-[1320px] px-7">
        <div className="mb-8 grid items-end gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
              <s aria-hidden="true" className="bg-brand block h-px w-7" />
              Reseñas
            </p>
            <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-bold tracking-[-0.02em]">
              Lo que dicen los que ya se fueron con el auto
            </h2>
          </div>
          {summary && (
            <p className="text-muted-foreground max-w-[30ch] font-mono text-[11px] leading-relaxed tracking-[0.14em] uppercase md:text-right">
              {summary.average} / 5 · {summary.count}{" "}
              {summary.count === 1 ? "reseña" : "reseñas"}
              <br />
              Publicadas por el local
            </p>
          )}
        </div>

        <ReviewsQuote reviews={reviews} />
      </div>
    </section>
  );
}
