// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests for `getSession()`.
 *
 * These pin the shape 56 call sites depend on, which is **flat**: the session
 * record itself with `user` attached -- `{ sessionToken, userId, expires,
 * user }` -- not a `{ session, user }` wrapper. Measured across `src/`: 63
 * reads of `session.user`, 4 of `session.expires`, 0 of `session.session`.
 *
 * `better-auth` returns the nested shape, so the adapter in `session.ts` is the
 * only thing standing between the two. That mapping is what this file guards.
 */

interface BetterAuthSession {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

const state = vi.hoisted(() => ({
  result: null as BetterAuthSession | null,
  getSession: vi.fn(async () => state.result),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { api: { getSession: state.getSession } },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// `redirect()` is control flow, not a value: Next throws an error carrying the
// `NEXT_REDIRECT` digest. The mock reproduces that so the guard can be asserted
// without a Next runtime.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const digest = `NEXT_REDIRECT;replace;${url};307;`;
    const error = new Error(digest) as Error & { digest: string };
    error.digest = digest;
    throw error;
  },
}));

import { getSession, requireAuthSession } from "@/lib/auth/session";

function buildSession(overrides: Partial<BetterAuthSession["user"]> = {}) {
  return {
    session: {
      id: "session-1",
      token: "token-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    user: {
      id: "user-1",
      name: "Administrador",
      email: "admin@caragency.com",
      emailVerified: false,
      image: null,
      role: "ADMIN",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    },
  } satisfies BetterAuthSession;
}

beforeEach(() => {
  state.result = buildSession();
  state.getSession.mockClear();
});

describe("getSession", () => {
  it("returns null when better-auth has no session", async () => {
    state.result = null;

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns the flat session shape, not a { session, user } wrapper", async () => {
    const result = await getSession();

    expect(result).not.toBeNull();
    // Flat: these live on the returned object itself.
    expect(result?.sessionToken).toBe("token-1");
    expect(result?.userId).toBe("user-1");
    expect(result?.expires).toBeInstanceOf(Date);
    // The wrapper must NOT exist.
    expect(result).not.toHaveProperty("session");
  });

  it("exposes the user the app reads from", async () => {
    const result = await getSession();

    expect(result?.user.id).toBe("user-1");
    expect(result?.user.email).toBe("admin@caragency.com");
    expect(result?.user.role).toBe("ADMIN");
    expect(result?.user.isActive).toBe(true);
  });

  it("returns null when the user is deactivated", async () => {
    state.result = buildSession({ isActive: false });

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when the session has already expired", async () => {
    const session = buildSession();
    session.session.expiresAt = new Date(Date.now() - 1_000);
    state.result = session;

    await expect(getSession()).resolves.toBeNull();
  });

  it("reads the session from the request headers", async () => {
    await getSession();

    expect(state.getSession).toHaveBeenCalledOnce();
    expect(state.getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });
});

describe("requireAuthSession", () => {
  it("redirects to the login page instead of throwing a plain error", async () => {
    state.result = null;

    // A throw here is what downgraded the layout's 307 to a 200 + meta refresh
    // when a stale cookie pointed at a deleted session row.
    await expect(requireAuthSession()).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/admin/login;307;",
    });
  });

  it("returns the session when one exists", async () => {
    const session = await requireAuthSession();

    expect(session.user.id).toBe("user-1");
    expect(session.sessionToken).toBe("token-1");
  });
});
