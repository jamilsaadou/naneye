import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Données invalides" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  const hashed = createHash("sha256").update(parsed.data.password).digest("hex");

  if (!user || hashed !== user.passwordHash) {
    return NextResponse.json({ message: "Identifiants invalides" }, { status: 401 });
  }

  const response = NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  response.cookies.set({
    name: "session",
    value: Buffer.from(JSON.stringify({ id: user.id, role: user.role })).toString("base64"),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
