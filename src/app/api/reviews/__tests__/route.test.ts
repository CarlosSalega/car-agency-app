// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the staff-side creation of a testimonial: who may call it, what it
 * persists, that every write is audited, and that the public cache is dropped so
 * the change is actually visible.
 *
 * A review is a public claim about the business, so the negative controls matter
 * as much as the happy path: a non-ADMIN must not be able to publish one, and a
 * future date or a half-star rating must not reach the table.
 */

const state = vi.hoisted(() => {
  const reviewCreate = vi.fn(async (args: { data: unknown }) => ({
    id: "review-1",
    ...(args.data as Record<string, unknown>),
  }));
  const logCreate = vi.fn(async () => ({}));

  const tx = {
    review: { create: reviewCreate },
    log: { create: logCreate },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };

  return {
    reviewCreate,
    logCreate,
    prisma,
    revalidateReviews: vi.fn(),
    session: {
      value: { user: { id: "admin-1", role: "ADMIN" } } as {
        user: { id: string; role: string };
      } | null,
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: state.prisma }));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => state.session.value),
}));

vi.mock("@/lib/cache", async () => ({
  revalidateReviews: state.revalidateReviews,
}));

import { POST } from "@/app/api/reviews/route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

const valid = {
  authorName: "Norma Soñez",
  rating: 5,
  text: "Gracias Facundo por la amabilidad y la atención.",
  reviewedAt: "2026-07-01T12:00:00.000Z",
  photoPath: "/reviews/norma-sonez.webp",
  sortOrder: 2,
  isPublished: true,
};

describe("POST /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session.value = { user: { id: "admin-1", role: "ADMIN" } };
  });

  it("rejects an anonymous request", async () => {
    state.session.value = null;

    const response = await post(valid);

    expect(response.status).toBe(401);
    expect(state.reviewCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-ADMIN, even with a valid body", async () => {
    state.session.value = { user: { id: "collab-1", role: "COLLABORATOR" } };

    const response = await post(valid);

    expect(response.status).toBe(403);
    expect(state.reviewCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["a future date", { reviewedAt: "2030-01-01T12:00:00.000Z" }],
    ["a rating above five", { rating: 6 }],
    ["a fractional rating", { rating: 4.5 }],
    ["a text that is too short", { text: "ok" }],
    ["a photo path that is not served by us", { photoPath: "reviews/a.webp" }],
    ["an empty author", { authorName: "  " }],
  ])("rejects %s", async (_label, patch) => {
    const response = await post({ ...valid, ...patch });

    expect(response.status).toBe(400);
    expect(state.reviewCreate).not.toHaveBeenCalled();
  });

  it("creates the review, audits it and drops the public cache", async () => {
    const response = await post(valid);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true });

    expect(state.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorName: "Norma Soñez",
          rating: 5,
          isPublished: true,
        }),
      }),
    );
    expect(state.logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CREATE",
        entity: "Review",
        entityId: "review-1",
        userId: "admin-1",
      }),
    });
    expect(state.revalidateReviews).toHaveBeenCalledTimes(1);
  });

  it("defaults a new review to unpublished when the flag is absent", async () => {
    const { isPublished: _ignored, ...withoutFlag } = valid;

    const response = await post(withoutFlag);

    expect(response.status).toBe(201);
    expect(state.reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublished: false }),
      }),
    );
  });
});
