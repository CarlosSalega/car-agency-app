import { getPublishedReviews } from "@/lib/queries/reviews";

import {
  GOOGLE_OVERALL_RATING,
  GOOGLE_TOTAL_REVIEWS,
} from "./reviews/review-google";
import { ReviewsQuote } from "./reviews/reviews-quote";

/**
 * The testimonials section, read from the database.
 *
 * Two decisions survive from the previous version because they were right:
 *
 * 1. **Only published rows, and nothing at all when there are none.** A heading
 *    that promises proof and then renders an empty box is worse than no section.
 * 2. **The Google numbers are Google's and stay plain text.** 4.9/249 is not our
 *    aggregate; the `aggregateRating` Google reads comes from the published rows
 *    in the landing JSON-LD. Turning this badge into structured data is exactly
 *    what got it removed before.
 *
 * What changed is the shape: one large quote instead of six cards, and the names
 * on the side as a list you can click.
 */
export default async function Reviews() {
  const reviews = await getPublishedReviews();

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
              Reseñas · {GOOGLE_OVERALL_RATING} en Google
            </p>
            <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-bold tracking-[-0.02em]">
              Lo que dicen los que ya se fueron con el auto
            </h2>
          </div>
          <p className="text-muted-foreground max-w-[30ch] font-mono text-[11px] leading-relaxed tracking-[0.14em] uppercase md:text-right">
            {GOOGLE_OVERALL_RATING} / 5 · {GOOGLE_TOTAL_REVIEWS} reseñas
            <br />
            Publicadas por el local
          </p>
        </div>

        <ReviewsQuote reviews={reviews} />
      </div>
    </section>
  );
}
