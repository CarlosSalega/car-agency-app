import { MELI_API_BASE, MELI_TOKEN_URL, type MeliConfig } from "./config";
import type { MeliTokens } from "./store";

/**
 * The two network steps of the OAuth flow.
 *
 * Both take `fetch` injected for the same reason as the token manager: the
 * exchange is where this flow breaks, so it has to be testable without a real
 * authorization code.
 */

export interface MeliProfile {
  meliUserId: string;
  nickname: string;
  siteId: string | null;
}

export type ExchangeResult =
  | { ok: true; tokens: MeliTokens }
  | { ok: false; message: string };

export async function exchangeCodeForTokens({
  config,
  code,
  codeVerifier,
  fetchImpl = fetch,
  now = () => new Date(),
}: {
  config: MeliConfig;
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<ExchangeResult> {
  let response: Response;

  try {
    response = await fetchImpl(MELI_TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      // ML documents body parameters, not a query string, for this exchange.
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "network error",
    };
  }

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
    message?: string;
  };

  if (!response.ok || !body.access_token || !body.refresh_token) {
    return {
      ok: false,
      message:
        body.error_description ??
        body.message ??
        body.error ??
        `HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    tokens: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(now().getTime() + (body.expires_in ?? 21_600) * 1000),
      scope: body.scope ?? null,
    },
  };
}

/**
 * Who we just linked. `null` when the profile cannot be read, which is not fatal:
 * the tokens are already valid, the screen just shows the id instead of a name.
 */
export async function fetchMeliProfile({
  accessToken,
  fetchImpl = fetch,
}: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<MeliProfile | null> {
  try {
    const response = await fetchImpl(`${MELI_API_BASE}/users/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      id?: number | string;
      nickname?: string;
      site_id?: string;
    };

    if (body.id === undefined) return null;

    return {
      meliUserId: String(body.id),
      nickname: body.nickname?.trim() || String(body.id),
      siteId: body.site_id ?? null,
    };
  } catch {
    return null;
  }
}
