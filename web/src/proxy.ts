import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "cms_session";

/**
 * Fast redirect for signed-out visitors. The API still validates every request;
 * this only avoids rendering admin screens without a session cookie.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/users/:path*", "/branches/:path*", "/settings/:path*", "/audit/:path*", "/members/:path*", "/households/:path*", "/ministries/:path*", "/events/:path*", "/rooms/:path*", "/school/:path*"],
};
