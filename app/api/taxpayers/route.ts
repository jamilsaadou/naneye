import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const groupId = searchParams.get("groupId") ?? undefined;

  const where: Record<string, any> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) {
    where.category = { contains: category, mode: "insensitive" };
  }
  if (status) {
    where.status = status;
  }
  if (groupId) {
    where.groupId = groupId;
  }

  const taxpayers = await prisma.taxpayer.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(taxpayers);
}

export async function POST(request: Request) {
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

  const taxpayer = await prisma.taxpayer.create({
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

  return NextResponse.json(taxpayer, { status: 201 });
}
