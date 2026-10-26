// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the rule that a password change invalidates the sessions the old
 * password opened.
 *
 * Without it, an attacker holding a stolen session survives the exact action
 * the victim takes to lock them out. The one exception is an admin changing
 * their own password: the session that made the request is spared, so the
 * response is not immediately followed by a logout.
 */

const state = vi.hoisted(() => {
  const sessionDeleteMany = vi.fn(async () => ({ count: 1 }));
  const accountUpdateMany = vi.fn(async () => ({ count: 1 }));
  const accountCreate = vi.fn(async () => ({}));
  const userUpdate = vi.fn(async () => ({
    id: "user-2",
    name: "Beto",
    email: "beto@caragency.com",
    role: "COLLABORATOR",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  }));
  const logCreate = vi.fn(async () => ({}));
  const userFindFirst = vi.fn(async () => null);

  const tx = {
    user: { update: userUpdate },
    account: { updateMany: accountUpdateMany, create: accountCreate },
    session: { deleteMany: sessionDeleteMany },
  };

  const prisma = {
    user: { findFirst: userFindFirst },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    log: { create: logCreate },
  };

  return {
    sessionDeleteMany,
    accountUpdateMany,
    userUpdate,
    logCreate,
    prisma,
    sessionToken: "tok-current",
    actorId: "admin-1",
  };
});

vi.mock("@/lib/db", () => ({ prisma: state.prisma }));

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    sessionToken: state.sessionToken,
    userId: state.actorId,
    expires: new Date(Date.now() + 60_000),
    user: { id: state.actorId, role: "ADMIN" },
  }),
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: async (value: string) => `hashed:${value}`,
}));

import { PUT } from "../route";

function putRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost:3000/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  state.sessionDeleteMany.mockClear();
  state.accountUpdateMany.mockClear();
  state.userUpdate.mockClear();
  state.logCreate.mockClear();
});

describe("PUT /api/users/[id] password change", () => {
  it("deletes every session of the target user", async () => {
    const response = await PUT(
      putRequest("user-2", {
        name: "Beto",
        email: "beto@caragency.com",
        password: "nueva1234",
      }),
      params("user-2"),
    );

    expect(response.status).toBe(200);
    expect(state.accountUpdateMany).toHaveBeenCalledOnce();
    expect(state.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-2" },
    });
  });

  it("spares the acting admin's own session when they change their own password", async () => {
    await PUT(
      putRequest(state.actorId, {
        name: "Admin",
        email: "admin@caragency.com",
        password: "nueva1234",
      }),
      params(state.actorId),
    );

    expect(state.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: state.actorId, NOT: { token: state.sessionToken } },
    });
  });

  it("leaves sessions alone when the payload carries no password", async () => {
    await PUT(
      putRequest("user-2", {
        name: "Beto",
        email: "beto@caragency.com",
      }),
      params("user-2"),
    );

    expect(state.accountUpdateMany).not.toHaveBeenCalled();
    expect(state.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than the configured minimum", async () => {
    const response = await PUT(
      putRequest("user-2", {
        name: "Beto",
        email: "beto@caragency.com",
        password: "corta",
      }),
      params("user-2"),
    );

    expect(response.status).toBe(400);
    expect(state.userUpdate).not.toHaveBeenCalled();
    expect(state.sessionDeleteMany).not.toHaveBeenCalled();
  });
});
