/**
 * Cookie names for the OAuth round trip.
 *
 * Kept out of the route files on purpose: a Next route module may only export its
 * handlers and route config, so shared values need a home of their own.
 */
export const MELI_OAUTH_STATE_COOKIE = "meli_oauth_state";
export const MELI_OAUTH_VERIFIER_COOKIE = "meli_oauth_verifier";
export const MELI_OAUTH_COOKIE_PATH = "/api/integrations/mercadolibre";

/** Long enough for a slow login, short enough that a leaked cookie dies. */
export const MELI_OAUTH_COOKIE_MAX_AGE = 10 * 60;

export const meliOAuthCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: MELI_OAUTH_COOKIE_PATH,
  maxAge: MELI_OAUTH_COOKIE_MAX_AGE,
};
