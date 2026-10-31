// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the staff-side lead update: who may call it, what it persists, and that
 * a status change is always audited.
 *
 * The audit row is the whole point of S5 ("every status change is written to
 * `Log`"), so it is asserted as part of the same transaction the status is
 * written in, not as a side effect that could be skipped.
 */

const state = vi.hoisted(() => {
  const leadFindUnique = vi.fn(
    async (): Promise<{ id: string } | null> => ({ id: "lead-1" }),
  );
  const leadUpdate = vi.fn(async () => ({
    id: "lead-1",
    status: "WON",
    notes: "Llamar mañana",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
  }));
  const logCreate = vi.fn(async () => ({}));

  const tx = {
    lead: { findUnique: leadFindUnique, update: leadUpdate },
    log: { create: logCreate },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };

  return {
    leadFindUnique,
    leadUpdate,
    logCreate,
    prisma,
    session: {
      value: { user: { id: "admin-1", role: "ADMIN" } } as {
        user: { id: string; role: string };
      } | null,
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: state.prisma }));

vi.mock("@/lib/auth", () => ({
  getSession: async () => state.session.value,
}));

import { PATCH } from "../route";

function patchRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  state.session.value = { user: { id: "admin-1", role: "ADMIN" } };

  state.leadFindUnique.mockReset();
  state.leadFindUnique.mockImplementation(async () => ({ id: "lead-1" }));

  state.leadUpdate.mockReset();
  state.leadUpdate.mockImplementation(async () => ({
    id: "lead-1",
    status: "WON",
    notes: "Llamar mañana",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
  }));

  state.logCreate.mockReset();
  state.logCreate.mockImplementation(async () => ({}));
});

describe("PATCH /api/leads/[id]", () => {
  it("answers 401 without a session and writes nothing", async () => {
    state.session.value = null;

    const response = await PATCH(patchRequest("lead-1", { status: "WON" }), {
      params: Promise.resolve({ id: "lead-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "No autorizado" });
    expect(state.leadUpdate).not.toHaveBeenCalled();
    expect(state.logCreate).not.toHaveBeenCalled();
  });

  it("answers 403 for a signed-in collaborator and writes nothing", async () => {
    state.session.value = { user: { id: "collab-1", role: "COLLABORATOR" } };

    const response = await PATCH(patchRequest("lead-1", { status: "WON" }), {
      params: Promise.resolve({ id: "lead-1" }),
    });

    expect(response.status).toBe(403);
    expect(state.leadUpdate).not.toHaveBeenCalled();
    expect(state.logCreate).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown lead and writes nothing", async () => {
    state.leadFindUnique.mockImplementation(async () => null);

    const response = await PATCH(patchRequest("nope", { status: "WON" }), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Consulta no encontrada",
    });
    expect(state.leadUpdate).not.toHaveBeenCalled();
    expect(state.logCreate).not.toHaveBeenCalled();
  });

  it("answers 400 with the zod errors for a status outside the enum", async () => {
    const response = await PATCH(
      patchRequest("lead-1", { status: "DONE", notes: "algo" }),
      params("lead-1"),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.fieldErrors.status).toBeDefined();
    expect(state.leadUpdate).not.toHaveBeenCalled();
    expect(state.logCreate).not.toHaveBeenCalled();
  });

  it("persists the new status and writes exactly one audit row", async () => {
    const response = await PATCH(
      patchRequest("lead-1", { status: "WON", notes: "  Llamar mañana  " }),
      params("lead-1"),
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.lead).toMatchObject({ id: "lead-1", status: "WON" });

    expect(state.leadUpdate).toHaveBeenCalledOnce();
    expect(state.leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: { status: "WON", notes: "Llamar mañana" },
      }),
    );

    expect(state.logCreate).toHaveBeenCalledOnce();
    expect(state.logCreate).toHaveBeenCalledWith({
      data: {
        action: "UPDATE",
        entity: "Lead",
        entityId: "lead-1",
        userId: "admin-1",
      },
    });
  });

  it("stores an empty note as null instead of an empty string", async () => {
    await PATCH(
      patchRequest("lead-1", { status: "CONTACTED", notes: "   " }),
      params("lead-1"),
    );

    expect(state.leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CONTACTED", notes: null },
      }),
    );
    expect(state.logCreate).toHaveBeenCalledOnce();
  });
});
