import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  date: z.string().optional(),
});

/**
 * Edita un gasto extra ya cargado.
 *
 * Lo delicado acá es el presupuesto: al crear el gasto se le restó `amount` a
 * budgetRemaining, así que al editarlo hay que ajustar solo por la DIFERENCIA.
 * Si el gasto pasa de $500 a $700, se descuentan $200 más; si baja a $300, se
 * devuelven $200. Restar el monto nuevo entero descontaría dos veces.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );

  const { description, amount, date } = parsed.data;

  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!expense)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (expense.project.userId !== userId)
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const diferencia = amount - expense.amount;

  // No se bloquea por presupuesto: si se pasa, el saldo queda en rojo y la
  // pantalla avisa. La obra tiene que poder reflejar lo que pasó de verdad.
  const actualizado = await prisma.$transaction(async (tx) => {
    const e = await tx.expense.update({
      where: { id: params.id },
      data: {
        description,
        amount,
        ...(date ? { date: new Date(date) } : {}),
      },
    });
    // decrement con diferencia negativa devuelve plata al presupuesto.
    await tx.project.update({
      where: { id: expense.projectId },
      data: { budgetRemaining: { decrement: diferencia } },
    });
    return e;
  });

  return NextResponse.json(actualizado);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!expense)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (expense.project.userId !== userId)
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: params.id } });
    await tx.project.update({
      where: { id: expense.projectId },
      data: { budgetRemaining: { increment: expense.amount } },
    });
  });

  return NextResponse.json({ ok: true });
}
