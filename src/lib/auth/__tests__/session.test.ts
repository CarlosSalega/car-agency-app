// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSession, deleteSession, getSession } from "@/lib/auth/session";

/**
 * Characterization tests for the hand-rolled session layer.
 *
 * These describe behaviour that already exists, so they are green on arrival.
 * The point is to pin the `getSession()` contract before the better-auth
 * migration, because 56 call sites depend on its exact shape: a `{ session,
 * user }` object or `null`, with `session.expires`, `user.isActive` and
 * `user.role` intact.
 */

interface SessionRow {
  sessionToken: string;
  userId: string;
  expires: Date;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "COLLABORATOR";
  isActive: boolean;
}

interface CookieRecord {
  value: string;
  options?: Record<string, unknown>;
}

const state = vi.hoisted(() => ({
  sessions: [] as SessionRow[],
  users: new Map<string, UserRow>(),
  cookies: new Map<string, CookieRecord>(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      create: vi.fn(async ({ data }: { data: SessionRow }) => {
        state.sessions.push(data);
        return data;
      }),
      findUnique: vi.fn(
        async ({ where }: { where: { sessionToken: string } }) => {
          const row = state.sessions.find(
            (s) => s.sessionToken === where.sessionToken,
          );
          if (!row) return null;
          const user = state.users.get(row.userId);
          if (!user) return null;
          return { ...row, user };
        },
      ),
      delete: vi.fn(async ({ where }: { where: { sessionToken: string } }) => {
        const index = state.sessions.findIndex(
          (s) => s.sessionToken === where.sessionToken,
        );
        if (index >= 0) state.sessions.splice(index, 1);
        return {};
      }),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const record = state.cookies.get(name);
      return record ? { name, value: record.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      state.cookies.set(name, { value, options });
    },
    delete: (name: string) => {
      state.cookies.delete(name);
    },
  }),
}));

const activeUser: UserRow = {
  id: "user-1",
  email: "admin@caragency.com",
  name: "Administrador",
  role: "ADMIN",
  isActive: true,
};

beforeEach(() => {
  state.sessions.length = 0;
  state.users.clear();
  state.cookies.clear();
  state.users.set(activeUser.id, { ...activeUser });
});

describe("createSession", () => {
  it("persists a session row and sets the session cookie", async () => {
    await createSession(activeUser.id);

    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]?.userId).toBe(activeUser.id);

    const cookie = state.cookies.get("session");
    expect(cookie?.value).toBe(state.sessions[0]?.sessionToken);
  });

  it("marks the cookie httpOnly, lax and path-scoped", async () => {
    await createSession(activeUser.id);

    expect(state.cookies.get("session")?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("expires the session one hour after creation", async () => {
    const before = Date.now();
    await createSession(activeUser.id);

    const expires = state.sessions[0]?.expires.getTime() ?? 0;
    const oneHour = 60 * 60 * 1000;
    expect(expires - before).toBeGreaterThan(oneHour - 5_000);
    expect(expires - before).toBeLessThan(oneHour + 5_000);
  });
});

describe("getSession", () => {
  it("returns null when there is no session cookie", async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns the session and its user for a valid cookie", async () => {
    await createSession(activeUser.id);

    const result = await getSession();

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(activeUser.id);
    expect(result?.user.role).toBe("ADMIN");
    expect(result?.user.isActive).toBe(true);
    // The returned object is the session row itself, with `user` attached --
    // not a `{ session, user }` wrapper. 56 call sites read `session.user` and
    // `session.expires` directly.
    expect(result?.expires).toBeInstanceOf(Date);
    expect(result?.sessionToken).toBe(state.sessions[0]?.sessionToken);
    expect(result?.userId).toBe(activeUser.id);
  });

  it("returns null when the session has expired", async () => {
    await createSession(activeUser.id);
    const row = state.sessions[0];
    if (!row) throw new Error("expected a session row");
    row.expires = new Date(Date.now() - 1_000);

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when the user is deactivated", async () => {
    await createSession(activeUser.id);
    const user = state.users.get(activeUser.id);
    if (!user) throw new Error("expected a user row");
    user.isActive = false;

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null for a token that does not exist", async () => {
    state.cookies.set("session", { value: "not-a-real-token" });

    await expect(getSession()).resolves.toBeNull();
  });
});

describe("deleteSession", () => {
  it("removes the session row and clears the cookie", async () => {
    await createSession(activeUser.id);
    expect(state.sessions).toHaveLength(1);

    await deleteSession();

    expect(state.sessions).toHaveLength(0);
    expect(state.cookies.has("session")).toBe(false);
  });

  it("is safe when no session exists", async () => {
    await expect(deleteSession()).resolves.toBeUndefined();
    expect(state.cookies.has("session")).toBe(false);
  });
});
