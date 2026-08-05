import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrderOwned } from "@/lib/materiales";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  supplier: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  orderDate: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const owned = await getOrderOwned(params.id, userId);
  if (!owned)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const order = await prisma.materialOrder.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json(order);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const owned = await getOrderOwned(params.id, userId);
  if (!owned)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );

  const d = parsed.data;
  const order = await prisma.materialOrder.update({
    where: { id: params.id },
    data: {
      name: d.name ?? owned.name,
      supplier: d.supplier !== undefined ? d.supplier || null : owned.supplier,
      notes: d.notes !== undefined ? d.notes || null : owned.notes,
      orderDate: d.orderDate ? new Date(d.orderDate) : owned.orderDate,
    },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(order);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const owned = await getOrderOwned(params.id, userId);
  if (!owned)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.materialOrder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
