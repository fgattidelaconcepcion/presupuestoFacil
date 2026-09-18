import { prisma } from "@/lib/prisma";

export type OrderStatus = "pending" | "partial" | "complete";

/**
 * Precio × cantidad, redondeado a 2 decimales.
 * Sin precio cargado (0) la línea no vale nada y no toca el presupuesto.
 */
export function itemCost(
  unitPrice?: number | null,
  cantidad?: number | null,
): number {
  const c = (unitPrice ?? 0) * (cantidad ?? 0);
  if (!Number.isFinite(c) || c <= 0) return 0;
  return Math.round(c * 100) / 100;
}

/**
 * Lo que un material DESCUENTA del presupuesto: precio × cantidad RECIBIDA.
 * Mientras no llega nada no descuenta; si llega parcial, descuenta esa parte.
 */
export function itemSpent(item: {
  unitPrice?: number | null;
  quantityReceived?: number | null;
}): number {
  return itemCost(item.unitPrice, item.quantityReceived);
}

/** Lo que ya descontó un pedido (suma de lo recibido de cada material). */
export function orderSpent(
  items: { unitPrice?: number | null; quantityReceived?: number | null }[],
): number {
  const total = items.reduce((s, i) => s + itemSpent(i), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Lo que vale el pedido completo (precio × cantidad PEDIDA): plata
 * comprometida, todavía no descontada si el material no llegó.
 */
export function orderCommitted(
  items: { unitPrice?: number | null; quantityOrdered?: number | null }[],
): number {
  const total = items.reduce(
    (s, i) => s + itemCost(i.unitPrice, i.quantityOrdered),
    0,
  );
  return Math.round(total * 100) / 100;
}

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
