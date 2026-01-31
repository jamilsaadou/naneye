import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signCollectorJwt } from "@/lib/collector-api";

const loginSchema = z
  .object({
    email: z.string().email().optional(),
    code: z.string().min(2).optional(),
    password: z.string().min(6),
  })
  .refine((data) => Boolean(data.email || data.code), {
    message: "Email ou code requis",
    path: ["email"],
  });

const TOKEN_TTL_SECONDS = 5 * 60;

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    try {
      await prisma.collectorApiLog.create({
        data: {
          collectorId: null,
          noticeNumber: null,
          requestTxnId: null,
          jwtTxnId: null,
          jwtIssuer: null,
          status: "FAILED",
          message: "Données invalides",
          requestPayload: payload
            ? {
                email: payload.email ?? null,
                code: payload.code ?? null,
                hasPassword: Boolean(payload.password),
              }
            : null,
          responsePayload: { ok: false, message: "Données invalides" },
        },
      });
    } catch {
      // Ne pas bloquer la reponse si le log echoue.
    }
    return NextResponse.json({ ok: false, message: "Données invalides" }, { status: 400 });
  }

  const selector = parsed.data.email
    ? { email: parsed.data.email }
    : { code: parsed.data.code ?? "" };

  const collector = await prisma.collector.findFirst({ where: selector });
  if (!collector || !collector.jwtSecret || collector.status !== "ACTIVE") {
    try {
      await prisma.collectorApiLog.create({
        data: {
          collectorId: collector?.id ?? null,
          noticeNumber: null,
          requestTxnId: null,
          jwtTxnId: null,
          jwtIssuer: collector?.code ?? null,
          status: "FAILED",
          message: "Identifiants invalides",
          requestPayload: {
            email: parsed.data.email ?? null,
            code: parsed.data.code ?? null,
            hasPassword: true,
          },
          responsePayload: { ok: false, message: "Identifiants invalides" },
        },
      });
    } catch {
      // Ne pas bloquer la reponse si le log echoue.
    }
    return NextResponse.json({ ok: false, message: "Identifiants invalides" }, { status: 401 });
  }

  if (!safeEqual(parsed.data.password, collector.jwtSecret)) {
    try {
      await prisma.collectorApiLog.create({
        data: {
          collectorId: collector.id,
          noticeNumber: null,
          requestTxnId: null,
          jwtTxnId: null,
          jwtIssuer: collector.code,
          status: "FAILED",
          message: "Identifiants invalides",
          requestPayload: {
            email: parsed.data.email ?? null,
            code: parsed.data.code ?? null,
            hasPassword: true,
          },
          responsePayload: { ok: false, message: "Identifiants invalides" },
        },
      });
    } catch {
      // Ne pas bloquer la reponse si le log echoue.
    }
    return NextResponse.json({ ok: false, message: "Identifiants invalides" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signCollectorJwt(
    {
      iss: collector.code,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    collector.jwtSecret,
  );

  try {
    await prisma.collectorApiLog.create({
      data: {
        collectorId: collector.id,
        noticeNumber: null,
        requestTxnId: null,
        jwtTxnId: null,
        jwtIssuer: collector.code,
        status: "SUCCESS",
        message: "Login collecteur",
        requestPayload: {
          email: parsed.data.email ?? null,
          code: parsed.data.code ?? null,
          hasPassword: true,
        },
        responsePayload: { ok: true, expiresIn: TOKEN_TTL_SECONDS },
      },
    });
  } catch {
    // Ne pas bloquer la reponse si le log echoue.
  }

  return NextResponse.json({
    ok: true,
    token,
    expiresIn: TOKEN_TTL_SECONDS,
    collector: {
      id: collector.id,
      code: collector.code,
      name: collector.name,
      email: collector.email,
      phone: collector.phone,
    },
  });
}
