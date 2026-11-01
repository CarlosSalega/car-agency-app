"use client";

import type { PublicReview } from "@/lib/queries/reviews";

import { useScrollAnimation } from "../../hooks/useScrollAnimation";
import { Avatar, Stars, initialsFor } from "./review-stars";

import { formatRelativeReviewDate } from "@/lib/reviews";

/**
 * One testimonial card.
 *
 * The date label is derived from `reviewedAt` on every render, in UTC, with the
 * same formatter the panel uses: the phrase is never stored, so it cannot go
 * stale, and the server-rendered HTML matches the hydrated one in any timezone.
 *
 * The photo has no width/height pair any more — the column only stores the path.
 * A fixed height plus `object-cover` keeps the avatar column stable, which is what
 * those attributes were really protecting; the row no longer has to be edited when
 * a customer sends a differently sized picture.
 */
export function ReviewCard({
  review,
  index,
}: {
  review: PublicReview;
  index: number;
}) {
  // `HTMLElement`, not `HTMLDivElement`: the ref lands on an `<article>`, and the
  // old generic only type-checked because React's ref props are bivariant. It was
  // recorded as latent debt in `odd/honest-notes.md`; this rewrite is where it
  // gets fixed instead of copied.
  const { ref, isVisible } = useScrollAnimation<HTMLElement>({
    rootMargin: "0px 0px -80px 0px",
  });

  return (
    <article
      ref={ref}
      className={`border-border bg-card hover:border-foreground/25 rounded-lg border p-6 shadow-sm transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-md ${
        isVisible
          ? "translate-y-0 opacity-100"
          : index % 2 === 0
            ? "-translate-x-15 translate-y-10 opacity-0"
            : "translate-x-15 translate-y-10 opacity-0"
      }`}
      style={{
        transitionDelay: isVisible ? `${index * 90}ms` : "0ms",
      }}
    >
      <header className="mb-4 flex items-center gap-3">
        <Avatar initials={initialsFor(review.authorName)} />

        <div className="flex-1">
          <p className="text-foreground text-sm font-bold">
            {review.authorName}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatRelativeReviewDate(review.reviewedAt)}
          </p>
        </div>

        {review.photoPath && (
          // eslint-disable-next-line @next/next/no-img-element -- sized by the card, not the layout
          <img
            src={review.photoPath}
            alt={review.authorName}
            className="h-20 rounded-md object-cover"
            loading="lazy"
          />
        )}
      </header>

      <Stars rating={review.rating} />

      <p className="text-subtle-foreground mt-3 text-sm leading-relaxed whitespace-pre-line">
        {review.text}
      </p>
    </article>
  );
}
