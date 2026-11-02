import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/catalogo", "/autos", "/contacto"] as const;
/** Prefijos públicos: la ficha del auto sigue viviendo en `/autos/[slug]`. */
const PUBLIC_PREFIXES = ["/autos/"] as const;

const CACHE_HEADERS = {
  IMAGES: "public, max-age=31536000, immutable, stale-while-revalidate=86400",
  PUBLIC_PAGES: "public, s-maxage=300, stale-while-revalidate=600",
} as const;

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number]) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isImageRequest(pathname: string, url: string): boolean {
  return pathname.startsWith("/_next/image") || url.includes("cloudinary.com");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return response;
    }

    // Optimistic gate only: presence of better-auth's session cookie, whose
    // name is `better-auth.session_token` (prefixed further on https). The
    // authoritative check -- signature, expiry and `isActive` -- happens in
    // the admin layout via `getSession()`.
    if (!getSessionCookie(request)) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  if (isImageRequest(pathname, request.url)) {
    response.headers.set("Cache-Control", CACHE_HEADERS.IMAGES);
  }

  if (isPublicRoute(pathname)) {
    response.headers.set("Cache-Control", CACHE_HEADERS.PUBLIC_PAGES);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
