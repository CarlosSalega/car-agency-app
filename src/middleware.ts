import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/autos", "/contacto"] as const;

const CACHE_HEADERS = {
  IMAGES: "public, max-age=31536000, immutable, stale-while-revalidate=86400",
  PUBLIC_PAGES: "public, s-maxage=300, stale-while-revalidate=600",
} as const;

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith("/autos/"),
  );
}

function isImageRequest(pathname: string, url: string): boolean {
  return pathname.startsWith("/_next/image") || url.includes("cloudinary.com");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get("session");

    if (pathname === "/admin/login") {
      return response;
    }

    if (!sessionCookie) {
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
