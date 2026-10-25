// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requireAdmin,
  requireAuth,
  withAdmin,
  withAuth,
} from "@/lib/auth/auth-middleware";

/**
 * Characterization tests for the route guards.
 *
 * `requireAuth` / `requireAdmin` / `withAuth` / `withAdmin` are the boundary
 * every protected route relies on, so their status codes must survive the
 * better-auth migration unchanged: 401 for "no session", 403 for "not an
 * admin".
 *
 * The session object is flat -- `{ sessionToken, userId, expires, user }` --
 * because that is exactly what `getSession()` returns and what the 63 call
 * sites of `session.user` expect.
 */

type Role = "ADMIN" | "COLLABORATOR";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

interface SessionShape {
  sessionToken: string;
  userId: string;
  expires: Date;
  user: SessionUser;
}

const state = vi.hoisted(() => ({
  session: null as SessionShape | null,
}));

// Mock the barrel, not `./session`: `auth-middleware.ts` imports from
// `@/lib/auth`, and the real barrel also re-exports `./auth`, which builds a
// Prisma client on import.
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => state.session),
}));

function buildSession(role: Role, isActive = true): SessionShape {
  return {
    sessionToken: "token-1",
    userId: "user-1",
    expires: new Date(Date.now() + 60_000),
    user: {
      id: "user-1",
      email: "someone@caragency.com",
      name: "Someone",
      role,
      isActive,
    },
  };
}

beforeEach(() => {
  state.session = null;
});

describe("requireAuth", () => {
  it("throws 401 when there is no session", async () => {
    await expect(requireAuth()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 when the session has expired", async () => {
    const session = buildSession("ADMIN");
    session.expires = new Date(Date.now() - 1_000);
    state.session = session;

    await expect(requireAuth()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 403 when the user is inactive", async () => {
    state.session = buildSession("ADMIN", false);

    await expect(requireAuth()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns the user for a valid session", async () => {
    state.session = buildSession("COLLABORATOR");

    await expect(requireAuth()).resolves.toMatchObject({ id: "user-1" });
  });
});

describe("requireAdmin", () => {
  it("throws 403 for a collaborator", async () => {
    state.session = buildSession("COLLABORATOR");

    await expect(requireAdmin()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns the user for an admin", async () => {
    state.session = buildSession("ADMIN");

    await expect(requireAdmin()).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("throws 401 before checking the role when there is no session", async () => {
    await expect(requireAdmin()).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("withAuth / withAdmin", () => {
  const request = new NextRequest("http://localhost/api/protected");

  it("withAuth passes the user to the handler", async () => {
    state.session = buildSession("COLLABORATOR");
    const handler = vi.fn(async () => Response.json({ ok: true }) as never);

    const response = await withAuth(handler)(request);

    expect(handler).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("withAuth answers 401 instead of throwing", async () => {
    const response = await withAuth(async () => Response.json({}) as never)(
      request,
    );

    expect(response.status).toBe(401);
  });

  it("withAdmin answers 403 for a collaborator", async () => {
    state.session = buildSession("COLLABORATOR");

    const response = await withAdmin(async () => Response.json({}) as never)(
      request,
    );

    expect(response.status).toBe(403);
  });

  it("withAdmin lets an admin through", async () => {
    state.session = buildSession("ADMIN");
    const handler = vi.fn(async () => Response.json({ ok: true }) as never);

    const response = await withAdmin(handler)(request);

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });
});
