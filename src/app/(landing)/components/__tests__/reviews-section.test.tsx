// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Reviews from "../Reviews";

/**
 * Pins the four things the public section promises:
 *
 * 1. It renders what is published, with the customer's own words.
 * 2. With nothing published it renders **nothing at all** — not an empty box
 *    under a heading that claims a thousand happy customers.
 * 3. Choosing a name changes the quote. That is the only interaction the section
 *    has, and it is what replaced the six-card grid.
 * 4. The aggregate it prints is the one the published rows support, read through
 *    `getPublishedReviewSummary`. It used to be a literal — the previous client's
 *    real 5.0 from six reviews — which any deployment would have published no
 *    matter what its own rows said.
 */

const { getPublishedReviews, getPublishedReviewSummary } = vi.hoisted(() => ({
  getPublishedReviews: vi.fn(),
  getPublishedReviewSummary: vi.fn(),
}));

vi.mock("@/lib/queries/reviews", () => ({
  getPublishedReviews,
  getPublishedReviewSummary,
}));

const published = [
  {
    id: "review-1",
    authorName: "Ana Pérez",
    rating: 5,
    text: "Atención clara y sin vueltas.",
    reviewedAt: "2026-07-01T12:00:00.000Z",
    photoPath: "/reviews/ana-perez.webp",
    sortOrder: 1,
  },
  {
    id: "review-2",
    authorName: "Diego Gómez",
    rating: 4,
    text: "Me explicaron todo antes de firmar.",
    reviewedAt: "2026-10-11T12:00:00.000Z",
    photoPath: null,
    sortOrder: 2,
  },
];

describe("the public reviews section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublishedReviews.mockResolvedValue([]);
    getPublishedReviewSummary.mockResolvedValue(null);
  });

  it("renders nothing when no review is published", async () => {
    await expect(Reviews()).resolves.toBeNull();
  });

  it("renders the published testimonial, verbatim", async () => {
    getPublishedReviews.mockResolvedValue(published);

    render(await Reviews());

    expect(screen.getByText("Ana Pérez")).toBeTruthy();
    expect(screen.getByText(/Atención clara y sin vueltas/)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Diego Gómez · 4★" })).toBeTruthy();
  });

  it("switches the quote when a different author is chosen", async () => {
    getPublishedReviews.mockResolvedValue(published);

    render(await Reviews());
    await userEvent.click(
      screen.getByRole("tab", { name: "Diego Gómez · 4★" }),
    );

    expect(screen.getByText(/Me explicaron todo antes de firmar/)).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Diego Gómez · 4★" }),
    ).toHaveProperty("ariaSelected", "true");
  });

  it("prints the aggregate the published rows support, not a typed-in number", async () => {
    getPublishedReviews.mockResolvedValue(published);
    // Two rows rated 5 and 4. The mean is 4.5, not the previous client's 5.0,
    // and the count is 2, not the previous client's 6.
    getPublishedReviewSummary.mockResolvedValue({ count: 2, average: 4.5 });

    render(await Reviews());

    expect(screen.getByText(/4\.5 \/ 5 · 2 reseñas/)).toBeTruthy();
    expect(screen.queryByText(/6 reseñas/)).toBeNull();
    // The header is a label, not a claim: "Reseñas · 5 en Google" is gone with the
    // constant it was quoting. (The "Dejar reseña en Google" call to action is
    // separate copy and is not what this test pins.)
    expect(screen.getByText("Reseñas")).toBeTruthy();
  });

  it("still renders the testimonials when there is no aggregate to print", async () => {
    getPublishedReviews.mockResolvedValue(published);
    getPublishedReviewSummary.mockResolvedValue(null);

    render(await Reviews());

    expect(screen.getByText("Ana Pérez")).toBeTruthy();
    // No mean, no count: the section publishes nothing rather than guessing.
    expect(screen.queryByText(/\/ 5/)).toBeNull();
    expect(screen.queryByText(/reseñas$/)).toBeNull();
  });
});
