import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let email = "";
  const session = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
  if (session) {
    try {
      const decoded = JSON.parse(Buffer.from(session, "base64").toString("utf-8")) as { id?: string };
      if (decoded?.id) {
        const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { email: true } });
        email = user?.email ?? "";
      }
    } catch {
      email = "";
    }
  }

  const url = new URL("/login", request.url);
  if (email) url.searchParams.set("email", email);
  const response = NextResponse.redirect(url);
  response.cookies.set({ name: "session", value: "", path: "/", maxAge: 0 });
  return response;
}
