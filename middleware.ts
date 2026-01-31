import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((path) => pathname === path)) return true;
  if (pathname.startsWith("/api/collector")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function hasSessionCookie(request: NextRequest) {
  const raw = request.cookies.get("session")?.value;
  if (!raw) return false;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    return Boolean(decoded?.id && decoded?.role);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionOk = hasSessionCookie(request);

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && sessionOk) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  if (!sessionOk) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: "/:path*",
};
