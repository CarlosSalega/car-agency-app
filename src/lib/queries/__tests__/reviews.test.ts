import { beforeEach, describe, expect, it, vi } from "vitest";

const { reviewMocks } = vi.hoisted(() => ({
  reviewMocks: {
    findMany: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (callback: (...args: unknown[]) => unknown) => callback,
}));

vi.mock("@/lib/db", () => ({
  prisma: { review: reviewMocks },
}));

import {
  getPublishedReviewSummary,
  getPublishedReviews,
} from "@/lib/queries/reviews";

/**
 * The public read is the boundary that decides what a visitor can see, so it is
 * pinned here instead of being inferred from the component: an unpublished
 * testimonial must never leave this function, and the order the section renders
 * in is a decision, not whatever the database happens to return.
 */

const rows = [
  {
    id: "r1",
    authorName: "Ana",
    rating: 5,
    text: "Excelente",
    reviewedAt: new Date("2026-08-01T12:00:00.000Z"),
    photoPath: "/reviews/ana-perez.webp",
    sortOrder: 1,
  },
  {
    id: "r2",
    authorName: "Diego",
    rating: 4,
    text: "Muy bien",
    reviewedAt: new Date("2026-07-01T12:00:00.000Z"),
    photoPath: null,
    sortOrder: 2,
  },
];

describe("getPublishedReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewMocks.findMany.mockResolvedValue(rows);
  });

  it("asks only for published rows", async () => {
    await getPublishedReviews();

    expect(reviewMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } }),
    );
  });

  it("orders by the manual sort order, then newest first", async () => {
    await getPublishedReviews();

    expect(reviewMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { reviewedAt: "desc" }],
      }),
    );
  });

  it("returns the rows with a JSON-safe date", async () => {
    // `unstable_cache` serializes to JSON, so a `Date` that crosses it comes back
    // as a string. A test that mocked the cache as identity hid exactly this and
    // the landing 500'd on the first real request, so the conversion is asserted
    // here instead of being implicit.
    await expect(getPublishedReviews()).resolves.toEqual([
      { ...rows[0], reviewedAt: "2026-08-01T12:00:00.000Z" },
      { ...rows[1], reviewedAt: "2026-07-01T12:00:00.000Z" },
    ]);
  });
});

describe("getPublishedReviewSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is null when there is nothing published", async () => {
    reviewMocks.findMany.mockResolvedValue([]);

    await expect(getPublishedReviewSummary()).resolves.toBeNull();
  });

  it("counts and averages the published rows, to one decimal", async () => {
    reviewMocks.findMany.mockResolvedValue([
      ...rows,
      { ...rows[0], id: "r3", rating: 5 },
    ]);

    // (5 + 4 + 5) / 3 = 4.666… -> 4.7, never 4.9 typed by hand.
    await expect(getPublishedReviewSummary()).resolves.toEqual({
      count: 3,
      average: 4.7,
    });
  });

  it("keeps a whole average whole instead of padding it", async () => {
    reviewMocks.findMany.mockResolvedValue(rows);

    await expect(getPublishedReviewSummary()).resolves.toEqual({
      count: 2,
      average: 4.5,
    });
  });
});
