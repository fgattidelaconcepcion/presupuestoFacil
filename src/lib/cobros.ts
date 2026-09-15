import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Recalcula el adelanto cacheado de la obra = suma de todos sus cobros.
 * Project.advanceAmount queda siempre igual al total cobrado, así el resto
 * de la app (dashboard, PDFs) sigue leyendo un solo número.
 */
export async function syncAdvance(tx: Tx, projectId: string): Promise<number> {
  const agg = await tx.cobro.aggregate({
    where: { projectId },
    _sum: { amount: true },
  });
  const total = Math.round((agg._sum.amount ?? 0) * 100) / 100;
  await tx.project.update({
    where: { id: projectId },
    data: { advanceAmount: total },
  });
  return total;
}

/** Verifica que el cobro pertenezca a una obra del usuario. */
export async function getCobroOwned(id: string, userId: string) {
  const cobro = await prisma.cobro.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!cobro || cobro.project.userId !== userId) return null;
  return cobro;
}
