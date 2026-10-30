// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin, requireAuth } from "@/lib/auth/auth-middleware";

/**
 * Characterization tests for the two route guards.
 *
 * `requireAuth` / `requireAdmin` encode the status codes a protected route must
 * answer: 401 for "no session", 403 for "not an admin" or "inactive".
 *
 * Read this honestly: **no route imports these two today.** The live boundary is
 * `requireAuthSession()` in `./session.ts` plus the cookie check in
 * `src/proxy.ts`, and the 401s routes actually return are written inline. These
 * tests therefore protect the intended shape of the guards, not a boundary the
 * app currently exercises -- which is exactly why the green here was misleading
 * while `withAuth` / `withAdmin` also lived in the module, unused.
 *
 * The session object is flat -- `{ sessionToken, userId, expires, user }` --
 * because that is what `getSession()` returns.
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
