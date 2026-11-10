import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  MELI_DEFAULT_AUTH_HOST,
  buildAuthorizationUrl,
  readMeliConfig,
} from "../config";
import {
  createCodeChallenge,
  createCodeVerifier,
  createState,
  safeEqual,
} from "../pkce";

const FULL_ENV = {
  MELI_CLIENT_ID: "123456789",
  MELI_CLIENT_SECRET: "super-secret",
  MELI_REDIRECT_URI:
    "https://example.com/api/integrations/mercadolibre/callback",
  MELI_TOKEN_ENCRYPTION_KEY: "a-long-enough-development-secret",
};

describe("readMeliConfig", () => {
  it("reads a complete configuration", () => {
    const result = readMeliConfig(FULL_ENV);

    expect(result.ok).toBe(true);
    expect(result.ok && result.config.clientId).toBe("123456789");
    expect(result.ok && result.config.authHost).toBe(MELI_DEFAULT_AUTH_HOST);
  });

  it("names every missing variable instead of failing on the first", () => {
    const result = readMeliConfig({});

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.missing).toEqual([
      "MELI_CLIENT_ID",
      "MELI_CLIENT_SECRET",
      "MELI_REDIRECT_URI",
      "MELI_TOKEN_ENCRYPTION_KEY",
    ]);
  });

  it("treats a missing encryption key as not configured, never as 'store it in the clear'", () => {
    const withoutKey = { ...FULL_ENV, MELI_TOKEN_ENCRYPTION_KEY: "   " };

    expect(readMeliConfig(withoutKey)).toEqual({
      ok: false,
      missing: ["MELI_TOKEN_ENCRYPTION_KEY"],
    });
  });

  it("honours an overridden auth host for another ML site", () => {
    const result = readMeliConfig({
      ...FULL_ENV,
      MELI_AUTH_HOST: "https://auth.mercadolivre.com.br",
    });

    expect(result.ok && result.config.authHost).toBe(
      "https://auth.mercadolivre.com.br",
    );
  });
});

describe("buildAuthorizationUrl", () => {
  it("carries every parameter ML documents, including PKCE", () => {
    const url = new URL(
      buildAuthorizationUrl({
        authHost: MELI_DEFAULT_AUTH_HOST,
        clientId: "123",
        redirectUri: "https://example.com/cb",
        state: "state-abc",
        codeChallenge: "challenge-xyz",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      `${MELI_DEFAULT_AUTH_HOST}/authorization`,
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/cb");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-xyz");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("encodes a redirect uri with its own query string safely", () => {
    const url = new URL(
      buildAuthorizationUrl({
        authHost: MELI_DEFAULT_AUTH_HOST,
        clientId: "1",
        redirectUri: "https://x.ar/cb?a=1",
        state: "s",
        codeChallenge: "c",
      }),
    );

    expect(url.searchParams.get("redirect_uri")).toBe("https://x.ar/cb?a=1");
  });
});

describe("PKCE helpers", () => {
  it("generates a verifier inside the length RFC 7636 allows", () => {
    const verifier = createCodeVerifier();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("derives the S256 challenge exactly as the RFC defines it", () => {
    // Pinned vector: sha256("abc") as base64url.
    expect(createCodeChallenge("abc")).toBe(
      crypto.createHash("sha256").update("abc").digest("base64url"),
    );
  });

  it("generates a distinct state each time", () => {
    expect(createState()).not.toBe(createState());
  });

  it("compares in constant time and rejects a different value", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
