import { describe, expect, it } from "vitest";

import { withReviewStructuredData } from "@/lib/reviews";

/**
 * The structured data is the reason this whole feature exists, and it is also the
 * easiest place to lie without noticing.
 *
 * Google's rule for `aggregateRating` on a business is that it must describe
 * reviews that exist and are verifiable — the 4.9/249 that used to be typed into
 * the landing was neither, which is why it was removed. So the builder derives
 * everything from the published rows and emits **nothing** when there are none.
 */

const base = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  name: "GL Autos",
};

const review = (id: string, rating: number) => ({
  id,
  authorName: `Cliente ${id}`,
  rating,
  text: "Excelente atención.",
  reviewedAt: `2026-0${id}-05T12:00:00.000Z`,
  photoPath: null,
  sortOrder: Number(id),
});

describe("withReviewStructuredData", () => {
  it("adds nothing when there is nothing published", () => {
    const result = withReviewStructuredData(base, {
      summary: null,
      reviews: [],
    });

    expect(result).not.toHaveProperty("aggregateRating");
    expect(result).not.toHaveProperty("review");
  });

  it("publishes the average and the count derived from the rows", () => {
    const result = withReviewStructuredData(base, {
      summary: { count: 3, average: 4.7 },
      reviews: [review("1", 5), review("2", 4), review("3", 5)],
    });

    expect(result.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.7,
      reviewCount: 3,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("emits one Review per published row, with an ISO date", () => {
    const result = withReviewStructuredData(base, {
      summary: { count: 1, average: 5 },
      reviews: [review("1", 5)],
    });

    expect(result.review).toEqual([
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Cliente 1" },
        reviewRating: {
          "@type": "Rating",
          ratingValue: 5,
          bestRating: 5,
          worstRating: 1,
        },
        datePublished: "2026-01-05",
        reviewBody: "Excelente atención.",
      },
    ]);
  });

  it("keeps the dealer fields it was given", () => {
    const result = withReviewStructuredData(base, {
      summary: { count: 1, average: 5 },
      reviews: [review("1", 5)],
    });

    expect(result).toMatchObject({ "@type": "AutoDealer", name: "GL Autos" });
  });

  it("never emits the panel's unpublished columns", () => {
    const result = withReviewStructuredData(base, {
      summary: { count: 1, average: 5 },
      reviews: [review("1", 5)],
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("isPublished");
    expect(serialized).not.toContain("sortOrder");
    expect(serialized).not.toContain("photoPath");
  });
});
