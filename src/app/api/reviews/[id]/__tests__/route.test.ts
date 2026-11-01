// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the staff-side edit and removal of a testimonial.
 *
 * Publishing is an update, not a separate endpoint: `isPublished` is one field of
 * the same row, and a dedicated "publish" route would be a second way to write
 * the same column. What is asserted here is that every path audits the change and
 * revalidates the public read, including unpublishing — a hidden review that
 * stays on the landing is the failure this guards.
 */

const state = vi.hoisted(() => {
  const reviewFindUnique = vi.fn(
    async (): Promise<{ id: string } | null> => ({ id: "review-1" }),
  );
  const reviewUpdate = vi.fn(async (args: { data: unknown }) => ({
    id: "review-1",
    ...(args.data as Record<string, unknown>),
  }));
  const reviewDelete = vi.fn(async () => ({ id: "review-1" }));
  const logCreate = vi.fn(async () => ({}));

  const tx = {
    review: {
      findUnique: reviewFindUnique,
      update: reviewUpdate,
      delete: reviewDelete,
    },
    log: { create: logCreate },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };

  return {
    reviewFindUnique,
    reviewUpdate,
    reviewDelete,
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

import { DELETE, PATCH } from "@/app/api/reviews/[id]/route";

const params = { params: Promise.resolve({ id: "review-1" }) };

function request(method: "PATCH" | "DELETE", body?: unknown) {
  return new NextRequest("http://localhost/api/reviews/review-1", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session.value = { user: { id: "admin-1", role: "ADMIN" } };
    state.reviewFindUnique.mockResolvedValue({ id: "review-1" });
  });

  it("rejects an anonymous request", async () => {
    state.session.value = null;

    const response = await PATCH(
      request("PATCH", { isPublished: true }),
      params,
    );

    expect(response.status).toBe(401);
    expect(state.reviewUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-ADMIN", async () => {
    state.session.value = { user: { id: "collab-1", role: "COLLABORATOR" } };

    const response = await PATCH(
      request("PATCH", { isPublished: true }),
      params,
    );

    expect(response.status).toBe(403);
    expect(state.reviewUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty body: an update has to change something", async () => {
    const response = await PATCH(request("PATCH", {}), params);

    expect(response.status).toBe(400);
    expect(state.reviewUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown id", async () => {
    state.reviewFindUnique.mockResolvedValue(null);

    const response = await PATCH(request("PATCH", { rating: 4 }), params);

    expect(response.status).toBe(404);
    expect(state.reviewUpdate).not.toHaveBeenCalled();
  });

  it("unpublishes, audits and revalidates so the card leaves the landing", async () => {
    const response = await PATCH(
      request("PATCH", { isPublished: false }),
      params,
    );

    expect(response.status).toBe(200);
    expect(state.reviewUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "review-1" } }),
    );
    expect(state.reviewUpdate.mock.calls[0][0].data).toMatchObject({
      isPublished: false,
    });
    expect(state.logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entity: "Review",
        entityId: "review-1",
      }),
    });
    expect(state.revalidateReviews).toHaveBeenCalledTimes(1);
  });

  it("edits the text without touching the publish flag", async () => {
    await PATCH(
      request("PATCH", { text: "Un texto corregido por el local." }),
      params,
    );

    expect(state.reviewUpdate.mock.calls[0][0].data).not.toHaveProperty(
      "isPublished",
    );
  });
});

describe("DELETE /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session.value = { user: { id: "admin-1", role: "ADMIN" } };
    state.reviewFindUnique.mockResolvedValue({ id: "review-1" });
  });

  it("rejects an anonymous request", async () => {
    state.session.value = null;

    const response = await DELETE(request("DELETE"), params);

    expect(response.status).toBe(401);
    expect(state.reviewDelete).not.toHaveBeenCalled();
  });

  it("rejects a non-ADMIN", async () => {
    state.session.value = { user: { id: "collab-1", role: "COLLABORATOR" } };

    const response = await DELETE(request("DELETE"), params);

    expect(response.status).toBe(403);
    expect(state.reviewDelete).not.toHaveBeenCalled();
  });

  it("deletes, audits and revalidates", async () => {
    const response = await DELETE(request("DELETE"), params);

    expect(response.status).toBe(200);
    expect(state.reviewDelete).toHaveBeenCalledWith({
      where: { id: "review-1" },
    });
    expect(state.logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE",
        entity: "Review",
        entityId: "review-1",
      }),
    });
    expect(state.revalidateReviews).toHaveBeenCalledTimes(1);
  });

  it("answers 404 for an unknown id instead of pretending it deleted", async () => {
    state.reviewFindUnique.mockResolvedValue(null);

    const response = await DELETE(request("DELETE"), params);

    expect(response.status).toBe(404);
    expect(state.reviewDelete).not.toHaveBeenCalled();
  });
});
