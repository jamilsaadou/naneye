import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCsrfHeader, assertCsrfToken } from "@/lib/csrf";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await assertCsrfHeader(request);
  } catch {
    try {
      const formData = await request.formData();
      await assertCsrfToken(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token CSRF invalide.";
      return NextResponse.json({ message }, { status: 403 });
    }
  }

  let email = "";
  const session = await getSession();
  if (session?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { email: true } });
    email = user?.email ?? "";
  }

  const url = new URL("/login", request.url);
  if (email) url.searchParams.set("email", email);
  const response = NextResponse.redirect(url);
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
  return response;
}
