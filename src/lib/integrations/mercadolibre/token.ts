import { MELI_TOKEN_URL, type MeliConfig } from "./config";
import {
  clearLinkedAccount,
  readLinkedAccount,
  saveLinkedAccount,
  type MeliTokens,
} from "./store";

/**
 * Access-token lifecycle.
 *
 * Two facts from ML's documentation drive this module:
 *
 * 1. **An access token lasts 6 hours.** Refreshing after a call fails wastes a
 *    round trip and, worse, surfaces an error a user cannot act on, so the token
 *    is refreshed ahead of expiry instead.
 * 2. **A refresh token is single-use.** Two concurrent refreshes race: the first
 *    consumes it, the second gets `invalid_grant` and the account looks dead. So
 *    refreshes are single-flight — concurrent callers await the same promise.
 *
 * Everything is injected so the whole lifecycle can be tested without a network
 * call and without a database.
 */

/** Refresh this long before the token expires. */
export const REFRESH_SKEW_MS = 10 * 60 * 1000;

export function needsRefresh(
  expiresAt: Date,
  now: Date,
  skewMs: number = REFRESH_SKEW_MS,
): boolean {
  return expiresAt.getTime() - now.getTime() <= skewMs;
}

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | {
      ok: false;
      reason: "not_linked" | "relink_required" | "provider_error";
      message?: string;
    };

export interface TokenManagerDeps {
  read: () => Promise<{
    tokens: MeliTokens | null;
  } | null>;
  save: (tokens: MeliTokens) => Promise<void>;
  clear: () => Promise<void>;
  config: MeliConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface RefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  message?: string;
  error_description?: string;
}

export function createTokenManager(deps: TokenManagerDeps) {
  let inFlight: Promise<AccessTokenResult> | null = null;

  const now = deps.now ?? (() => new Date());
  const doFetch = deps.fetchImpl ?? fetch;

  async function refresh(
    currentRefreshToken: string,
  ): Promise<AccessTokenResult> {
    let response: Response;

    try {
      response = await doFetch(MELI_TOKEN_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: deps.config.clientId,
          client_secret: deps.config.clientSecret,
          refresh_token: currentRefreshToken,
        }),
      });
    } catch (error) {
      // The provider was unreachable. Keep the tokens: a network blip is not a
      // reason to force the dealership to link again.
      return {
        ok: false,
        reason: "provider_error",
        message: error instanceof Error ? error.message : "network error",
      };
    }

    const body = (await response.json().catch(() => ({}))) as RefreshResponse;

    if (!response.ok || !body.access_token || !body.refresh_token) {
      // `invalid_grant` means the refresh token is dead: password change, manual
      // revocation, or a lost race. Keeping it would fail forever.
      if (
        body.error === "invalid_grant" ||
        body.error === "invalid_client" ||
        response.status === 400 ||
        response.status === 401
      ) {
        await deps.clear();
        return {
          ok: false,
          reason: "relink_required",
          message: body.error_description ?? body.message ?? body.error,
        };
      }

      return {
        ok: false,
        reason: "provider_error",
        message: body.message ?? `HTTP ${response.status}`,
      };
    }

    const expiresIn = body.expires_in ?? 21_600;
    const tokens: MeliTokens = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(now().getTime() + expiresIn * 1000),
      scope: body.scope ?? null,
    };

    await deps.save(tokens);

    return { ok: true, accessToken: tokens.accessToken };
  }

  async function run(): Promise<AccessTokenResult> {
    const stored = await deps.read();

    if (!stored) return { ok: false, reason: "not_linked" };

    if (!stored.tokens) {
      // Sealed values that cannot be opened: the only fix is linking again.
      await deps.clear();
      return { ok: false, reason: "relink_required" };
    }

    if (!needsRefresh(stored.tokens.expiresAt, now())) {
      return { ok: true, accessToken: stored.tokens.accessToken };
    }

    return refresh(stored.tokens.refreshToken);
  }

  return {
    getAccessToken(): Promise<AccessTokenResult> {
      if (inFlight) return inFlight;

      inFlight = run().finally(() => {
        inFlight = null;
      });

      return inFlight;
    },
    /** Only for tests that assert the single-flight behaviour directly. */
    isRefreshing(): boolean {
      return inFlight !== null;
    },
  };
}

export type TokenManager = ReturnType<typeof createTokenManager>;
