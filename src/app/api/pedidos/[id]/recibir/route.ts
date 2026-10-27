import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrderOwned, itemSpent, recalcOrderStatus } from "@/lib/materiales";
import { z } from "zod";

const schema = z.object({
  /** true = marcar todo el pedido como recibido; false = desmarcar todo. */
  received: z.boolean(),
});

/**
 * Marca (o desmarca) de una sola vez TODOS los materiales de un pedido,
 * para no tener que ir uno por uno. El presupuesto se ajusta por la
 * diferencia de lo recibido, igual que al marcar cada material.
 */
export async function POST(
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
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );

  const { received } = parsed.data;

  const items = await prisma.materialItem.findMany({
    where: { orderId: params.id },
  });
  if (items.length === 0)
    return NextResponse.json({ error: "El pedido no tiene materiales" }, {
      status: 400,
    });

  const ahora = new Date();
  let diferencia = 0;

  for (const i of items) {
    const antes = itemSpent(i);
    const despues = received
      ? itemSpent({ unitPrice: i.unitPrice, quantityReceived: i.quantityOrdered })
      : 0;
    diferencia += despues - antes;
  }
  diferencia = Math.round(diferencia * 100) / 100;

  await prisma.$transaction(async (tx) => {
    for (const i of items) {
      await tx.materialItem.update({
        where: { id: i.id },
        data: {
          quantityReceived: received ? i.quantityOrdered : 0,
          received,
          receivedAt: received ? (i.receivedAt ?? ahora) : null,
        },
      });
    }

    if (diferencia !== 0)
      await tx.project.update({
        where: { id: owned.projectId },
        data: { budgetRemaining: { decrement: diferencia } },
      });
  });

  const status = await recalcOrderStatus(params.id);
  const order = await prisma.materialOrder.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ ok: true, status, order });
}
