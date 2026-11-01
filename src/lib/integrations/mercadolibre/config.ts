/**
 * Mercado Libre integration configuration.
 *
 * Nothing here reads `process.env` at module scope: the values are passed in, so
 * the "is it configured?" decision is a pure function that tests can exercise
 * without a build-time environment.
 *
 * The integration is **optional**. A deployment without these variables keeps
 * working and the screen says so instead of throwing.
 */

export const MELI_ENV_VARS = {
  clientId: "MELI_CLIENT_ID",
  clientSecret: "MELI_CLIENT_SECRET",
  redirectUri: "MELI_REDIRECT_URI",
  encryptionKey: "MELI_TOKEN_ENCRYPTION_KEY",
  authHost: "MELI_AUTH_HOST",
} as const;

/** Argentina. Other sites use a different host, so it stays overridable. */
export const MELI_DEFAULT_AUTH_HOST = "https://auth.mercadolibre.com.ar";
export const MELI_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
export const MELI_API_BASE = "https://api.mercadolibre.com";

export interface MeliConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  authHost: string;
}

export type MeliConfigResult =
  | { ok: true; config: MeliConfig }
  | { ok: false; missing: string[] };

function read(env: Record<string, string | undefined>, name: string): string {
  return (env[name] ?? "").trim();
}

export function readMeliConfig(
  env: Record<string, string | undefined> = process.env,
): MeliConfigResult {
  const clientId = read(env, MELI_ENV_VARS.clientId);
  const clientSecret = read(env, MELI_ENV_VARS.clientSecret);
  const redirectUri = read(env, MELI_ENV_VARS.redirectUri);
  const encryptionKey = read(env, MELI_ENV_VARS.encryptionKey);

  const missing: string[] = [];
  if (!clientId) missing.push(MELI_ENV_VARS.clientId);
  if (!clientSecret) missing.push(MELI_ENV_VARS.clientSecret);
  if (!redirectUri) missing.push(MELI_ENV_VARS.redirectUri);
  // Sealing the tokens is not optional: without a key there is nowhere safe to
  // put a refresh token, so a missing key means "not configured", not "store it
  // in the clear".
  if (!encryptionKey) missing.push(MELI_ENV_VARS.encryptionKey);

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      encryptionKey,
      authHost: read(env, MELI_ENV_VARS.authHost) || MELI_DEFAULT_AUTH_HOST,
    },
  };
}

/**
 * The URL the admin is sent to. `state` and PKCE are both required by the flow
 * ML documents, and the redirect URI must match the registered one exactly.
 */
export function buildAuthorizationUrl({
  authHost,
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  authHost: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("/authorization", authHost);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}
