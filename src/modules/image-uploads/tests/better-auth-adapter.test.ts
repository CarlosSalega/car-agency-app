import { describe, expect, it, vi } from "vitest";

import {
  betterAuthActorFromSession,
  createBetterAuthActorResolver,
} from "../adapters/better-auth";

describe("betterAuthActorFromSession", () => {
  it("maps the session user to an actor", () => {
    expect(
      betterAuthActorFromSession({ user: { id: "user-1", role: "ADMIN" } }),
    ).toEqual({ id: "user-1", role: "ADMIN" });
  });

  it("omits the role key entirely when the user has none", () => {
    const actor = betterAuthActorFromSession({ user: { id: "user-1" } });

    expect(actor).toEqual({ id: "user-1" });
    expect(actor !== null && "role" in actor).toBe(false);
  });

  it("treats a missing session, missing user or empty id as unauthenticated", () => {
    expect(betterAuthActorFromSession(null)).toBeNull();
    expect(betterAuthActorFromSession(undefined)).toBeNull();
    expect(betterAuthActorFromSession({})).toBeNull();
    expect(betterAuthActorFromSession({ user: {} })).toBeNull();
    expect(betterAuthActorFromSession({ user: { id: "" } })).toBeNull();
  });

  it("treats a deactivated account as unauthenticated, and lets that rule be disabled", () => {
    expect(
      betterAuthActorFromSession({ user: { id: "user-1", isActive: false } }),
    ).toBeNull();
    expect(
      betterAuthActorFromSession({ user: { id: "user-1", isActive: true } }),
    ).toEqual({ id: "user-1" });
    expect(betterAuthActorFromSession({ user: { id: "user-1" } })).toEqual({
      id: "user-1",
    });
    expect(
      betterAuthActorFromSession(
        { user: { id: "user-1", isActive: false } },
        { requireActive: false },
      ),
    ).toEqual({
      id: "user-1",
    });
  });

  it("treats an expired session as unauthenticated", () => {
    const now = () => Date.parse("2025-01-01T00:00:00.000Z");

    expect(
      betterAuthActorFromSession(
        {
          user: { id: "user-1" },
          session: { expiresAt: new Date("2024-12-31T23:59:59.000Z") },
        },
        { now },
      ),
    ).toBeNull();

    expect(
      betterAuthActorFromSession(
        {
          user: { id: "user-1" },
          session: { expiresAt: "2025-06-01T00:00:00.000Z" },
        },
        { now },
      ),
    ).toEqual({ id: "user-1" });

    expect(
      betterAuthActorFromSession(
        {
          user: { id: "user-1" },
          session: { expiresAt: new Date("2024-12-31T00:00:00.000Z") },
        },
        { now, checkExpiry: false },
      ),
    ).toEqual({ id: "user-1" });
  });

  it("ignores a session without an expiry or with an unparseable one", () => {
    expect(
      betterAuthActorFromSession({ user: { id: "user-1" }, session: {} }),
    ).toEqual({ id: "user-1" });
    expect(
      betterAuthActorFromSession({
        user: { id: "user-1" },
        session: { expiresAt: "not-a-date" },
      }),
    ).toEqual({
      id: "user-1",
    });
  });
});

describe("createBetterAuthActorResolver", () => {
  it("returns the actor from the session lookup", async () => {
    const resolver = createBetterAuthActorResolver({
      getSession: async () => ({ user: { id: "user-1", role: "USER" } }),
    });

    await expect(resolver(new Request("http://localhost"))).resolves.toEqual({
      id: "user-1",
      role: "USER",
    });
  });

  it("returns null for an anonymous visitor", async () => {
    const resolver = createBetterAuthActorResolver({ getSession: () => null });

    await expect(resolver(new Request("http://localhost"))).resolves.toBeNull();
  });

  it("forwards the request to the lookup and applies the shared rules", async () => {
    const getSession = vi.fn(async () => ({
      user: { id: "user-1", isActive: false },
    }));
    const resolver = createBetterAuthActorResolver({ getSession });
    const request = new Request("http://localhost/api/upload");

    await expect(resolver(request)).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledWith(request);
  });

  it("works with the app-style zero-argument session helper", async () => {
    const getSession = vi.fn(async () => ({
      user: { id: "user-1", role: "ADMIN" },
      session: { expiresAt: null },
    }));
    const resolver = createBetterAuthActorResolver({
      getSession: () => getSession(),
    });

    await expect(resolver(new Request("http://localhost"))).resolves.toEqual({
      id: "user-1",
      role: "ADMIN",
    });
  });
});
