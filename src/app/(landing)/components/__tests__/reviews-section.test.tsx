// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Reviews from "../Reviews";

/**
 * Pins the two things the public section promises:
 *
 * 1. It renders what is published, with the customer's own words.
 * 2. With nothing published it renders **nothing at all** — not an empty grid
 *    under a heading that claims a thousand happy customers.
 */

const { getPublishedReviews } = vi.hoisted(() => ({
  getPublishedReviews: vi.fn(),
}));

vi.mock("@/lib/queries/reviews", () => ({ getPublishedReviews }));

// jsdom has no IntersectionObserver, and the card animates on intersection.
class IntersectionObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

const published = {
  id: "review-1",
  authorName: "Norma Soñez",
  rating: 5,
  text: "Gracias Facundo por la amabilidad y la atención a los detalles.",
  reviewedAt: "2026-07-01T12:00:00.000Z",
  photoPath: "/reviews/norma-sonez.webp",
  sortOrder: 1,
};

describe("the public reviews section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no review is published", async () => {
    getPublishedReviews.mockResolvedValue([]);

    await expect(Reviews()).resolves.toBeNull();
  });

  it("renders the published testimonial, verbatim", async () => {
    getPublishedReviews.mockResolvedValue([published]);

    render(await Reviews());

    expect(screen.getByText("Norma Soñez")).toBeTruthy();
    expect(screen.getByText(published.text)).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Calificación: 5 de 5" }),
    ).toBeTruthy();
  });

  it("still offers the Google call to action below the grid", async () => {
    getPublishedReviews.mockResolvedValue([published]);

    render(await Reviews());

    expect(screen.getByText("Dejá tu reseña en Google")).toBeTruthy();
  });
});
