import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCsrfHeader } from "@/lib/csrf";

const statusSchema = z.enum(["EN_ATTENTE", "ACTIVE", "ARCHIVED"]);

const taxpayerSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional().nullable(),
  neighborhood: z.string().min(2),
  commune: z.string().min(2),
  status: statusSchema.optional(),
  groupId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().min(6),
  email: z.string().email().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const taxpayer = await prisma.taxpayer.findUnique({ where: { id: params.id } });
  if (!taxpayer) {
    return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  }
  return NextResponse.json(taxpayer);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCsrfHeader(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token CSRF invalide.";
    return NextResponse.json({ message }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, string> | null;
  const parsed = taxpayerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Données invalides" }, { status: 400 });
  }

  if (parsed.data.groupId) {
    const group = await prisma.taxpayerGroup.findUnique({
      where: { id: parsed.data.groupId },
      include: { communes: { select: { name: true } } },
    });
    const matchesCommune = group?.isGlobal || group?.communes.some((item) => item.name === parsed.data.commune);
    if (!group || !matchesCommune) {
      return NextResponse.json({ message: "Groupe invalide" }, { status: 400 });
    }
  }

  const taxpayer = await prisma.taxpayer.update({
    where: { id: params.id },
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      neighborhood: parsed.data.neighborhood,
      commune: parsed.data.commune,
      status: parsed.data.status ?? "EN_ATTENTE",
      groupId: parsed.data.groupId ?? null,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      photoUrl: parsed.data.photoUrl,
      comment: parsed.data.comment,
      latitude: parsed.data.latitude || null,
      longitude: parsed.data.longitude || null,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
    },
  });

  return NextResponse.json(taxpayer);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCsrfHeader(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token CSRF invalide.";
    return NextResponse.json({ message }, { status: 403 });
  }
  const taxpayer = await prisma.taxpayer.update({
    where: { id: params.id },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json(taxpayer);
}
