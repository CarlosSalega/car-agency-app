import { describe, expect, it, vi } from "vitest";

import type { MeliConfig } from "../config";
import type { MeliTokens } from "../store";
import { REFRESH_SKEW_MS, createTokenManager, needsRefresh } from "../token";

const config: MeliConfig = {
  clientId: "app-id",
  clientSecret: "app-secret",
  redirectUri: "https://glautos.ar/cb",
  encryptionKey: "key",
  authHost: "https://auth.mercadolibre.com.ar",
};

const NOW = new Date("2026-11-05T12:00:00.000Z");

function tokens(overrides: Partial<MeliTokens> = {}): MeliTokens {
  return {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000),
    ...overrides,
  };
}

function harness(
  options: {
    stored?: { tokens: MeliTokens | null } | null;
    response?: { ok: boolean; status?: number; body: unknown } | Error;
  } = {},
) {
  const saved: MeliTokens[] = [];
  let cleared = 0;
  let fetchCalls = 0;

  const fetchImpl = vi.fn(async () => {
    fetchCalls += 1;
    const response = options.response;
    if (response instanceof Error) throw response;

    const value = response ?? {
      ok: true,
      body: {
        access_token: "access-2",
        refresh_token: "refresh-2",
        expires_in: 21600,
      },
    };

    return {
      ok: value.ok,
      status: value.status ?? 200,
      json: async () => value.body,
    } as Response;
  });

  const manager = createTokenManager({
    read: async () =>
      "stored" in options ? options.stored! : { tokens: tokens() },
    save: async (next) => {
      saved.push(next);
    },
    clear: async () => {
      cleared += 1;
    },
    config,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
  });

  return {
    manager,
    saved,
    fetchImpl,
    get cleared() {
      return cleared;
    },
    get fetchCalls() {
      return fetchCalls;
    },
  };
}

describe("needsRefresh", () => {
  it("is false while the token still has hours left", () => {
    expect(needsRefresh(tokens().expiresAt, NOW)).toBe(false);
  });

  it("is true inside the skew window, before the token actually dies", () => {
    const almostExpired = new Date(NOW.getTime() + REFRESH_SKEW_MS - 1);

    expect(needsRefresh(almostExpired, NOW)).toBe(true);
  });

  it("is true once expired", () => {
    expect(needsRefresh(new Date(NOW.getTime() - 1000), NOW)).toBe(true);
  });
});

describe("createTokenManager", () => {
  it("reports not_linked when nothing is stored", async () => {
    const { manager, fetchImpl } = harness({ stored: null });

    expect(await manager.getAccessToken()).toEqual({
      ok: false,
      reason: "not_linked",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns the current token without calling the provider when it is still fresh", async () => {
    const { manager, fetchImpl } = harness();

    expect(await manager.getAccessToken()).toEqual({
      ok: true,
      accessToken: "access-1",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refreshes ahead of expiry, stores the rotated pair and uses the new token", async () => {
    const harnessed = harness({
      stored: {
        tokens: tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }),
      },
    });

    const result = await harnessed.manager.getAccessToken();

    expect(result).toEqual({ ok: true, accessToken: "access-2" });
    expect(harnessed.saved[0]).toMatchObject({
      accessToken: "access-2",
      // The pair rotates together; keeping the old refresh token would break the
      // next refresh.
      refreshToken: "refresh-2",
    });
    expect(harnessed.saved[0].expiresAt.toISOString()).toBe(
      new Date(NOW.getTime() + 21_600_000).toISOString(),
    );

    const body = String(
      (harnessed.fetchImpl.mock.calls[0] as unknown[]).at(1) &&
        ((harnessed.fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit)
          .body,
    );
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=refresh-1");
  });

  it("runs one refresh for concurrent callers, because the refresh token is single-use", async () => {
    const harnessed = harness({
      stored: {
        tokens: tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }),
      },
    });

    const [first, second, third] = await Promise.all([
      harnessed.manager.getAccessToken(),
      harnessed.manager.getAccessToken(),
      harnessed.manager.getAccessToken(),
    ]);

    expect(harnessed.fetchCalls).toBe(1);
    expect(harnessed.saved).toHaveLength(1);
    expect([first, second, third]).toEqual([
      { ok: true, accessToken: "access-2" },
      { ok: true, accessToken: "access-2" },
      { ok: true, accessToken: "access-2" },
    ]);
  });

  it("clears the account and asks for a re-link when the refresh token is dead", async () => {
    const harnessed = harness({
      stored: { tokens: tokens({ expiresAt: new Date(NOW.getTime() - 1000) }) },
      response: { ok: false, status: 400, body: { error: "invalid_grant" } },
    });

    // The message is the provider's own text, so assert the reason and that a
    // message survives for the screen to show.
    expect(await harnessed.manager.getAccessToken()).toMatchObject({
      ok: false,
      reason: "relink_required",
      message: "invalid_grant",
    });
    expect(harnessed.cleared).toBe(1);
    expect(harnessed.saved).toHaveLength(0);
  });

  it("keeps the tokens when the provider is unreachable, because a blip is not a revocation", async () => {
    const harnessed = harness({
      stored: { tokens: tokens({ expiresAt: new Date(NOW.getTime() - 1000) }) },
      response: new Error("ECONNRESET"),
    });

    const result = await harnessed.manager.getAccessToken();

    expect(result).toMatchObject({ ok: false, reason: "provider_error" });
    expect(harnessed.cleared).toBe(0);
  });

  it("treats an unreadable sealed token as a re-link, not a crash", async () => {
    const harnessed = harness({ stored: { tokens: null } });

    expect(await harnessed.manager.getAccessToken()).toEqual({
      ok: false,
      reason: "relink_required",
    });
    expect(harnessed.cleared).toBe(1);
  });

  it("reports provider_error for a 500 without wiping the account", async () => {
    const harnessed = harness({
      stored: { tokens: tokens({ expiresAt: new Date(NOW.getTime() - 1000) }) },
      response: { ok: false, status: 500, body: { message: "boom" } },
    });

    expect(await harnessed.manager.getAccessToken()).toMatchObject({
      ok: false,
      reason: "provider_error",
    });
    expect(harnessed.cleared).toBe(0);
  });
});
