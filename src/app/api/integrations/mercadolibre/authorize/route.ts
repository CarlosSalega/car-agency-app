import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  buildAuthorizationUrl,
  readMeliConfig,
} from "@/lib/integrations/mercadolibre/config";
import {
  MELI_OAUTH_STATE_COOKIE,
  MELI_OAUTH_VERIFIER_COOKIE,
  meliOAuthCookieOptions,
} from "@/lib/integrations/mercadolibre/cookies";
import {
  createCodeChallenge,
  createCodeVerifier,
  createState,
} from "@/lib/integrations/mercadolibre/pkce";

/**
 * Step 1 of the OAuth flow: send the admin to Mercado Libre.
 *
 * `state` and the PKCE verifier live in short-lived, httpOnly cookies scoped to
 * this path. They are not stored in the database because they are only valid for
 * one trip and must not survive it.
 *
 * ADMIN only: linking decides which account the whole site publishes as.
 */

const CONFIG_URL = "/admin/config/mercadolibre";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.redirect(
      new URL(`${CONFIG_URL}?status=forbidden`, request.url),
    );
  }

  const config = readMeliConfig();

  if (!config.ok) {
    return NextResponse.redirect(
      new URL(`${CONFIG_URL}?status=not_configured`, request.url),
    );
  }

  const state = createState();
  const verifier = createCodeVerifier();

  const target = buildAuthorizationUrl({
    authHost: config.config.authHost,
    clientId: config.config.clientId,
    redirectUri: config.config.redirectUri,
    state,
    codeChallenge: createCodeChallenge(verifier),
  });

  const response = NextResponse.redirect(target);
  response.cookies.set(MELI_OAUTH_STATE_COOKIE, state, meliOAuthCookieOptions);
  response.cookies.set(
    MELI_OAUTH_VERIFIER_COOKIE,
    verifier,
    meliOAuthCookieOptions,
  );

  return response;
}
