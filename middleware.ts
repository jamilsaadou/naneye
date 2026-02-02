import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  getCsrfCookieOptions,
} from "@/lib/csrf-core";
import {
  createSessionToken,
  getSessionCookieOptions,
  readSessionToken,
  SESSION_COOKIE_NAME,
  shouldRotateSession,
} from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((path) => pathname === path)) return true;
  if (pathname.startsWith("/api/collector")) return true;
  if (pathname.startsWith("/api/uploads")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(sessionToken);
  const sessionOk = Boolean(session);
  const csrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  let response: NextResponse;
  if (isPublicPath(pathname)) {
    if (pathname === "/login" && sessionOk) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next();
    }
  } else if (!sessionOk) {
    if (pathname.startsWith("/api")) {
      response = NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    } else {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      response = NextResponse.redirect(url);
    }
  } else {
    response = NextResponse.next();
  }

  if (!csrfToken) {
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: generateCsrfToken(),
      ...getCsrfCookieOptions(request.headers),
    });
  }

  if (sessionToken && !session) {
    response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
  }

  if (session && shouldRotateSession(session)) {
    const refreshed = await createSessionToken({ id: session.id, role: session.role });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: refreshed,
      ...getSessionCookieOptions(),
    });
  }

  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: "/:path*",
};
