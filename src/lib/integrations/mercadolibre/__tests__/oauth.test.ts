import { describe, expect, it, vi } from "vitest";

import type { MeliConfig } from "../config";
import { exchangeCodeForTokens, fetchMeliProfile } from "../oauth";

const config: MeliConfig = {
  clientId: "app-id",
  clientSecret: "app-secret",
  redirectUri: "https://example.com/cb",
  encryptionKey: "key",
  authHost: "https://auth.mercadolibre.com.ar",
};

const NOW = new Date("2026-11-05T12:00:00.000Z");

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

describe("exchangeCodeForTokens", () => {
  it("sends the code as body parameters, not as a query string", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        access_token: "a",
        refresh_token: "r",
        expires_in: 21600,
      }),
    );

    await exchangeCodeForTokens({
      config,
      code: "the-code",
      codeVerifier: "the-verifier",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = String(init.body);

    expect(url).toBe("https://api.mercadolibre.com/oauth/token");
    expect(init.method).toBe("POST");
    expect(
      String((init.headers as Record<string, string>)["content-type"]),
    ).toContain("application/x-www-form-urlencoded");
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=the-code");
    expect(body).toContain("code_verifier=the-verifier");
    expect(body).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcb");
  });

  it("computes the expiry from expires_in instead of trusting a fixed hour", async () => {
    const result = await exchangeCodeForTokens({
      config,
      code: "c",
      codeVerifier: "v",
      fetchImpl: (async () =>
        jsonResponse({
          access_token: "a",
          refresh_token: "r",
          expires_in: 3600,
        })) as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok && result.tokens.expiresAt.toISOString()).toBe(
      new Date(NOW.getTime() + 3_600_000).toISOString(),
    );
  });

  it("surfaces the provider's own explanation when the code is rejected", async () => {
    const result = await exchangeCodeForTokens({
      config,
      code: "expired",
      codeVerifier: "v",
      fetchImpl: (async () =>
        jsonResponse(
          { error: "invalid_grant", error_description: "code expired" },
          { ok: false, status: 400 },
        )) as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, message: "code expired" });
  });

  it("fails without throwing when the provider is unreachable", async () => {
    const result = await exchangeCodeForTokens({
      config,
      code: "c",
      codeVerifier: "v",
      fetchImpl: (async () => {
        throw new Error("ECONNRESET");
      }) as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, message: "ECONNRESET" });
  });

  it("rejects a half answer that has no refresh token", async () => {
    const result = await exchangeCodeForTokens({
      config,
      code: "c",
      codeVerifier: "v",
      fetchImpl: (async () =>
        jsonResponse({ access_token: "a" })) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
  });
});

describe("fetchMeliProfile", () => {
  it("reads the id, nickname and site", async () => {
    const profile = await fetchMeliProfile({
      accessToken: "token",
      fetchImpl: (async () =>
        jsonResponse({
          id: 123456,
          nickname: "GL AUTOS",
          site_id: "MLA",
        })) as unknown as typeof fetch,
    });

    expect(profile).toEqual({
      meliUserId: "123456",
      nickname: "GL AUTOS",
      siteId: "MLA",
    });
  });

  it("falls back to the id when the account has no nickname", async () => {
    const profile = await fetchMeliProfile({
      accessToken: "t",
      fetchImpl: (async () =>
        jsonResponse({ id: 99 })) as unknown as typeof fetch,
    });

    expect(profile?.nickname).toBe("99");
  });

  it("sends the bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 1 }));

    await fetchMeliProfile({
      accessToken: "the-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.mercadolibre.com/users/me");
    expect(String((init.headers as Record<string, string>).authorization)).toBe(
      "Bearer the-token",
    );
  });

  it("returns null instead of throwing when the profile cannot be read", async () => {
    expect(
      await fetchMeliProfile({
        accessToken: "t",
        fetchImpl: (async () =>
          jsonResponse(
            {},
            { ok: false, status: 401 },
          )) as unknown as typeof fetch,
      }),
    ).toBeNull();
  });
});
