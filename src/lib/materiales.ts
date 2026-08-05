import { prisma } from "@/lib/prisma";

export type OrderStatus = "pending" | "partial" | "complete";

/**
 * Recalcula el estado de un pedido en base a sus items.
 * - complete: todos los items están marcados como recibidos
 * - pending: ningún item recibido y nada recibido parcialmente
 * - partial: cualquier situación intermedia
 */
export async function recalcOrderStatus(orderId: string): Promise<OrderStatus> {
  const items = await prisma.materialItem.findMany({ where: { orderId } });

  let status: OrderStatus = "pending";
  if (items.length > 0) {
    const allReceived = items.every((i) => i.received);
    const anyProgress = items.some((i) => i.received || i.quantityReceived > 0);
    status = allReceived ? "complete" : anyProgress ? "partial" : "pending";
  }

  await prisma.materialOrder.update({
    where: { id: orderId },
    data: { status },
  });

  return status;
}

/** Verifica que el pedido pertenezca a una obra del usuario. */
export async function getOrderOwned(orderId: string, userId: string) {
  const order = await prisma.materialOrder.findUnique({
    where: { id: orderId },
    include: { project: true },
  });
  if (!order || order.project.userId !== userId) return null;
  return order;
}

/** Verifica que el item pertenezca a una obra del usuario. */
export async function getItemOwned(itemId: string, userId: string) {
  const item = await prisma.materialItem.findUnique({
    where: { id: itemId },
    include: { order: { include: { project: true } } },
  });
  if (!item || item.order.project.userId !== userId) return null;
  return item;
}
