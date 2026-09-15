import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getItemOwned, itemCost, recalcOrderStatus } from "@/lib/materiales";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).max(20).optional(),
  quantityOrdered: z.number().positive().optional(),
  quantityReceived: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  received: z.boolean().optional(),
  notes: z.string().max(300).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getItemOwned(params.id, userId);
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

  const quantityOrdered = d.quantityOrdered ?? existing.quantityOrdered;

  // Reglas de recepción:
  // - Si se marca el checkbox y no se envía cantidad recibida, se asume que
  //   llegó todo lo pedido.
  // - Si se desmarca, la cantidad recibida vuelve a 0.
  // - Si se envía una cantidad recibida, el checkbox se deriva de ella.
  let received = d.received ?? existing.received;
  let quantityReceived = d.quantityReceived ?? existing.quantityReceived;

  if (d.received !== undefined && d.quantityReceived === undefined) {
    quantityReceived = d.received ? quantityOrdered : 0;
  }
  if (d.quantityReceived !== undefined) {
    quantityReceived = Math.max(0, d.quantityReceived);
    if (d.received === undefined) received = quantityReceived >= quantityOrdered;
  }
  // Si se recibió todo, el item queda marcado sí o sí.
  if (quantityReceived >= quantityOrdered && quantityOrdered > 0)
    received = true;
  if (quantityReceived === 0) received = false;

  // El presupuesto se ajusta SOLO por la diferencia de costo del material
  // (precio unitario × cantidad pedida), igual que en los gastos extras.
  const unitPrice = d.unitPrice ?? existing.unitPrice;
  const costoAnterior = itemCost(existing.unitPrice, existing.quantityOrdered);
  const costoNuevo = itemCost(unitPrice, quantityOrdered);
  const diferencia = Math.round((costoNuevo - costoAnterior) * 100) / 100;

  const project = existing.order.project;
  if (diferencia > 0 && project.budgetRemaining < diferencia)
    return NextResponse.json(
      {
        error: `Presupuesto insuficiente. Disponible: $${project.budgetRemaining.toFixed(2)}`,
      },
      { status: 400 },
    );

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.materialItem.update({
      where: { id: params.id },
      data: {
        name: d.name ?? existing.name,
        unit: d.unit ?? existing.unit,
        quantityOrdered,
        quantityReceived,
        received,
        unitPrice,
        receivedAt: received
          ? (existing.receivedAt ?? new Date())
          : quantityReceived > 0
            ? (existing.receivedAt ?? new Date())
            : null,
        notes: d.notes !== undefined ? d.notes || null : existing.notes,
      },
    });

    if (diferencia !== 0)
      await tx.project.update({
        where: { id: project.id },
        data: { budgetRemaining: { decrement: diferencia } },
      });

    return updated;
  });

  const status = await recalcOrderStatus(existing.orderId);
  return NextResponse.json({ ...item, orderStatus: status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getItemOwned(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Al borrar un material con precio, esa plata vuelve al presupuesto.
  const costo = itemCost(existing.unitPrice, existing.quantityOrdered);

  await prisma.$transaction(async (tx) => {
    await tx.materialItem.delete({ where: { id: params.id } });
    if (costo > 0)
      await tx.project.update({
        where: { id: existing.order.projectId },
        data: { budgetRemaining: { increment: costo } },
      });
  });

  await recalcOrderStatus(existing.orderId);

  return NextResponse.json({ ok: true });
}
