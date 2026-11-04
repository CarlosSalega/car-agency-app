// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Reviews from "../Reviews";

/**
 * Pins the three things the public section promises:
 *
 * 1. It renders what is published, with the customer's own words.
 * 2. With nothing published it renders **nothing at all** — not an empty box
 *    under a heading that claims a thousand happy customers.
 * 3. Choosing a name changes the quote. That is the only interaction the section
 *    has, and it is what replaced the six-card grid.
 */

const { getPublishedReviews } = vi.hoisted(() => ({
  getPublishedReviews: vi.fn(),
}));

vi.mock("@/lib/queries/reviews", () => ({ getPublishedReviews }));

const published = [
  {
    id: "review-1",
    authorName: "Norma Soñez",
    rating: 5,
    text: "Gracias Facundo por la amabilidad y la atención a los detalles.",
    reviewedAt: "2026-07-01T12:00:00.000Z",
    photoPath: "/reviews/norma-sonez.webp",
    sortOrder: 1,
  },
  {
    id: "review-2",
    authorName: "Diego Pucheta",
    rating: 5,
    text: "Excelente la atención, el asesoramiento de Lionel.",
    reviewedAt: "2026-10-11T12:00:00.000Z",
    photoPath: null,
    sortOrder: 2,
  },
];

describe("the public reviews section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no review is published", async () => {
    getPublishedReviews.mockResolvedValue([]);

    await expect(Reviews()).resolves.toBeNull();
  });

  it("renders the published testimonial, verbatim", async () => {
    getPublishedReviews.mockResolvedValue(published);

    render(await Reviews());

    expect(screen.getByText("Norma Soñez")).toBeTruthy();
    expect(screen.getByText(/Gracias Facundo por la amabilidad/)).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Diego Pucheta · 5★" }),
    ).toBeTruthy();
  });

  it("switches the quote when a different author is chosen", async () => {
    getPublishedReviews.mockResolvedValue(published);

    render(await Reviews());
    await userEvent.click(
      screen.getByRole("tab", { name: "Diego Pucheta · 5★" }),
    );

    expect(
      screen.getByText(/Excelente la atención, el asesoramiento de Lionel/),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Diego Pucheta · 5★" }),
    ).toHaveProperty("ariaSelected", "true");
  });
});
