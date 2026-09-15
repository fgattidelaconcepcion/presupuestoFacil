import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCobroOwned, syncAdvance } from "@/lib/cobros";
import { z } from "zod";

const updateSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0").optional(),
  date: z.string().optional(),
  note: z.string().max(200).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getCobroOwned(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );

  const d = parsed.data;

  const cobro = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.cobro.update({
      where: { id: params.id },
      data: {
        amount: d.amount ?? existing.amount,
        date: d.date ? new Date(d.date) : existing.date,
        note: d.note !== undefined ? d.note || null : existing.note,
      },
    });
    await syncAdvance(tx, existing.projectId);
    return actualizado;
  });

  return NextResponse.json(cobro);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getCobroOwned(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.cobro.delete({ where: { id: params.id } });
    await syncAdvance(tx, existing.projectId);
  });

  return NextResponse.json({ ok: true });
}
