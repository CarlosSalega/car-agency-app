import { getPublishedReviews } from "@/lib/queries/reviews";

import { SectionHeading } from "./ui/SectionHeading";
import { GoogleLogo } from "./ui/GoogleLogo";
import { ReviewCard } from "./reviews/review-card";
import {
  GOOGLE_OVERALL_RATING,
  GOOGLE_REVIEW_URL,
  GOOGLE_TOTAL_REVIEWS,
} from "./reviews/review-google";
import { Stars } from "./reviews/review-stars";
import { ReviewsCta } from "./reviews/reviews-cta";

/**
 * The testimonials section, read from the database.
 *
 * Two decisions live here:
 *
 * 1. **Only published rows, and nothing at all when there are none.** An empty
 *    grid under "Más de 1000 sueños cumplidos" is worse than no section: the
 *    heading promises proof the page then fails to deliver. Returning `null` is
 *    the honest state for a dealership that has not loaded its reviews yet.
 * 2. **The badge keeps Google's numbers and stays a plain link.** 4.9/249 is
 *    Google's aggregate, not ours; the `aggregateRating` Google reads comes from
 *    the published rows in the landing JSON-LD. Making this badge structured data
 *    is exactly what got it removed before.
 */
export default async function Reviews() {
  const reviews = await getPublishedReviews();

  if (reviews.length === 0) return null;

  return (
    <section className="bg-background relative w-full overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <SectionHeading
          eyebrow="Lo que dicen nuestros clientes"
          titleStart="Más de"
          titleAccent="1000 sueños"
          titleEnd="cumplidos"
        >
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Calificación ${GOOGLE_OVERALL_RATING} de 5 en Google con ${GOOGLE_TOTAL_REVIEWS} reseñas`}
            className="border-border bg-card mt-2 inline-flex max-w-full items-center gap-2 rounded-full border py-2 pr-4 pl-3 shadow-sm transition-all hover:scale-[1.03] hover:shadow-md sm:gap-2.5 sm:pr-5"
          >
            <GoogleLogo className="size-5 shrink-0" />
            <span className="text-foreground text-xl font-black">
              {GOOGLE_OVERALL_RATING}
            </span>
            <Stars
              rating={5}
              size="sm"
              lastStarFill={0.9}
              ariaLabel={`Calificación ${GOOGLE_OVERALL_RATING} de 5 en Google`}
            />
            <span className="text-muted-foreground truncate text-xs sm:text-sm">
              {GOOGLE_TOTAL_REVIEWS} reseñas
            </span>
          </a>
        </SectionHeading>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <ReviewCard key={review.id} review={review} index={index} />
          ))}
        </div>

        <ReviewsCta />
      </div>
    </section>
  );
}
