import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const payroll = await prisma.payroll.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!payroll)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (payroll.project.userId !== userId)
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (payroll.status === "open")
    return NextResponse.json(
      { error: "La semana ya está abierta" },
      { status: 400 },
    );

  // Solo puede haber una semana open a la vez
  const existingOpen = await prisma.payroll.findFirst({
    where: { projectId: payroll.projectId, status: "open" },
  });
  if (existingOpen)
    return NextResponse.json(
      { error: "Hay una semana abierta. Cerrala antes de reabrir otra." },
      { status: 400 },
    );

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { payrollId: payroll.id } });
    await tx.payroll.update({
      where: { id: payroll.id },
      data: { status: "open", totalPaid: 0 },
    });
    if (payroll.totalPaid > 0) {
      await tx.project.update({
        where: { id: payroll.projectId },
        data: { budgetRemaining: { increment: payroll.totalPaid } },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
