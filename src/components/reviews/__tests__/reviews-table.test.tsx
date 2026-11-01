// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminReview } from "../review-types";
import { ReviewsTable } from "../reviews-table";

/**
 * Pins what staff can act on from the list.
 *
 * The publish toggle is the risky one: it writes `isPublished` and revalidates the
 * public read, so the assertion is not just "a button exists" but that clicking it
 * sends the **flipped** value for that row's id. A toggle that reads stale state
 * would publish what an admin meant to hide.
 */

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

function buildReview(overrides: Partial<AdminReview> = {}): AdminReview {
  return {
    id: "review-1",
    authorName: "Norma Soñez",
    rating: 5,
    text: "Gracias Facundo por la amabilidad y la atención.",
    reviewedAt: new Date("2026-07-01T12:00:00.000Z"),
    photoPath: "/reviews/norma-sonez.webp",
    sortOrder: 1,
    isPublished: true,
    updatedAt: new Date("2026-07-02T12:00:00.000Z"),
    ...overrides,
  };
}

describe("ReviewsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the author and whether the review is live", () => {
    render(
      <ReviewsTable
        reviews={[
          buildReview(),
          buildReview({
            id: "review-2",
            authorName: "Dario Ledesma",
            isPublished: false,
          }),
        ]}
      />,
    );

    const published = screen.getByText("Norma Soñez").closest("tr");
    const hidden = screen.getByText("Dario Ledesma").closest("tr");

    expect(published).not.toBeNull();
    expect(
      within(published as HTMLElement).getByText("Publicada"),
    ).toBeTruthy();
    expect(within(hidden as HTMLElement).getByText("Oculta")).toBeTruthy();
  });

  it("explains the empty list instead of rendering a blank table", () => {
    render(<ReviewsTable reviews={[]} />);

    expect(screen.getByText("Todavía no hay reseñas")).toBeTruthy();
  });

  it("publishes a hidden review by sending the flipped flag", async () => {
    const hiddenReview = buildReview({ isPublished: false });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewsTable reviews={[hiddenReview]} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: `Publicar la reseña de ${hiddenReview.authorName}`,
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reviews/review-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isPublished: true }),
      }),
    );
    expect(refresh).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
