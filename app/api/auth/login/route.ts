import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCsrfHeader } from "@/lib/csrf";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    await assertCsrfHeader(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token CSRF invalide.";
    return NextResponse.json({ message }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Données invalides" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json({ message: "Identifiants invalides" }, { status: 401 });
  }

  const verification = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!verification.ok) {
    return NextResponse.json({ message: "Identifiants invalides" }, { status: 401 });
  }

  if (verification.needsRehash) {
    const newHash = await hashPassword(parsed.data.password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  }

  const response = NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const sessionToken = await createSessionToken({ id: user.id, role: user.role });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    ...getSessionCookieOptions(),
  });

  return response;
}
