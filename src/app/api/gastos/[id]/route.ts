import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
