import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  clearChannelAccounts,
  saveTokens,
} from "@/lib/integrations/channel-accounts";
import { readMeliConfig } from "@/lib/integrations/mercadolibre/config";
import {
  MELI_OAUTH_STATE_COOKIE,
  MELI_OAUTH_VERIFIER_COOKIE,
} from "@/lib/integrations/mercadolibre/cookies";
import {
  exchangeCodeForTokens,
  fetchMeliProfile,
} from "@/lib/integrations/mercadolibre/oauth";
import { safeEqual } from "@/lib/integrations/mercadolibre/pkce";

import { cookies } from "next/headers";

/**
 * Step 2: Mercado Libre sends the admin back with a code.
 *
 * Three things are checked before the code is redeemed:
 * - the session is an ADMIN's, because linking decides who the site publishes as;
 * - the `state` matches the cookie from step 1, so a callback URL crafted by
 *   somebody else cannot link their account to this site;
 * - the verifier cookie exists, because the PKCE proof is what makes the code
 *   unusable if it leaks.
 *
 * Every failure redirects to the screen with a machine-readable reason instead of
 * rendering a stack trace: the admin can act on "state_mismatch", not on a 500.
 */

const CONFIG_URL = "/admin/config/mercadolibre";

function back(request: Request, status: string): NextResponse {
  return NextResponse.redirect(
    new URL(`${CONFIG_URL}?status=${status}`, request.url),
  );
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (session.user.role !== "ADMIN") {
    return back(request, "forbidden");
  }

  const config = readMeliConfig();

  if (!config.ok) {
    return back(request, "not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return back(request, error === "access_denied" ? "denied" : "no_code");
  }

  const jar = await cookies();
  const storedState = jar.get(MELI_OAUTH_STATE_COOKIE)?.value;
  const verifier = jar.get(MELI_OAUTH_VERIFIER_COOKIE)?.value;

  if (!storedState || !state || !safeEqual(storedState, state)) {
    return back(request, "state_mismatch");
  }

  if (!verifier) {
    return back(request, "missing_verifier");
  }

  const exchanged = await exchangeCodeForTokens({
    config: config.config,
    code,
    codeVerifier: verifier,
  });

  if (!exchanged.ok) {
    console.warn("[MELI] Token exchange failed:", exchanged.message);
    return back(request, "exchange_failed");
  }

  const profile = await fetchMeliProfile({
    accessToken: exchanged.tokens.accessToken,
  });

  if (!profile) {
    // The tokens are valid but we cannot tell whose they are, and without the id
    // the "one linked account" rule cannot be enforced.
    return back(request, "profile_failed");
  }

  // Relinking replaces the previous account, the rule the old store enforced by
  // deleting the other rows: the admin card reads one connected row per channel,
  // and with two it would show whichever the query happened to return.
  await clearChannelAccounts("MERCADOLIBRE");

  await saveTokens({
    channel: "MERCADOLIBRE",
    remoteUserId: profile.meliUserId,
    remoteNickname: profile.nickname,
    siteId: profile.siteId,
    accessToken: exchanged.tokens.accessToken,
    refreshToken: exchanged.tokens.refreshToken,
    expiresAt: exchanged.tokens.expiresAt,
  });

  const response = back(request, "linked");
  // The round trip is over; these must not linger.
  response.cookies.delete(MELI_OAUTH_STATE_COOKIE);
  response.cookies.delete(MELI_OAUTH_VERIFIER_COOKIE);

  return response;
}
