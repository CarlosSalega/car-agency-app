"use client";

import { useState } from "react";

import type { PublicReview } from "@/lib/queries/reviews";
import { formatRelativeReviewDate } from "@/lib/reviews";

import { GOOGLE_REVIEW_URL } from "./review-google";

/**
 * The testimonials, as one quote at a time.
 *
 * Six cards side by side ask to be skimmed; one large quote asks to be read. The
 * list on the right keeps the names visible, so the reader knows how much is
 * behind the quote, and every name is a button: choosing who to read is cheaper
 * than waiting for an autoplay the visitor did not ask for.
 *
 * The date comes from `reviewedAt` through the same formatter the panel uses, so
 * the label can never say something the row does not.
 */
export function ReviewsQuote({ reviews }: { reviews: PublicReview[] }) {
  const [index, setIndex] = useState(0);
  const current = reviews[index] ?? reviews[0];

  const go = (next: number) => {
    setIndex((next + reviews.length) % reviews.length);
  };

  return (
    <div className="border-border grid border lg:grid-cols-[1.15fr_0.85fr]">
      <div className="border-border bg-card flex min-h-[300px] flex-col gap-5 border-b p-8 lg:border-r lg:border-b-0 lg:p-10">
        <p
          className="text-warning m-0 text-[13px] tracking-[0.3em]"
          aria-label={`${current.rating} de 5 estrellas`}
        >
          {"★".repeat(current.rating)}
        </p>

        <blockquote
          key={current.id}
          className="m-0 font-serif text-[clamp(20px,2.1vw,28px)] leading-[1.45] whitespace-pre-line text-[#ecebe7]"
        >
          “{current.text}”
        </blockquote>

        <div className="border-border mt-auto flex flex-wrap items-baseline justify-between gap-4 border-t pt-4">
          <b className="text-[15px]">{current.authorName}</b>
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
            {formatRelativeReviewDate(current.reviewedAt)}
          </span>
        </div>
      </div>

      <div className="bg-ground flex flex-col gap-3 p-6">
        <p className="text-muted-foreground m-0 font-mono text-[11px] tracking-[0.16em] uppercase">
          {index + 1} / {reviews.length}
        </p>

        <div
          className="flex flex-col gap-2"
          role="tablist"
          aria-label="Reseñas"
        >
          {reviews.map((review, position) => (
            <button
              key={review.id}
              type="button"
              role="tab"
              aria-selected={position === index}
              aria-current={position === index}
              onClick={() => go(position)}
              className={`border-border cursor-pointer border px-3.5 py-3 text-left font-sans text-[13px] transition-colors ${
                position === index
                  ? "border-brand bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {review.authorName} · {review.rating}★
            </button>
          ))}
        </div>

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Reseña anterior"
            className="border-line-strong hover:bg-accent hover:border-brand h-[38px] w-12 cursor-pointer border font-mono transition-colors"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Reseña siguiente"
            className="border-line-strong hover:bg-accent hover:border-brand h-[38px] w-12 cursor-pointer border font-mono transition-colors"
          >
            →
          </button>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-line-strong hover:bg-accent ml-auto flex h-[38px] items-center border px-3 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors"
          >
            Dejar reseña en Google
          </a>
        </div>
      </div>
    </div>
  );
}
