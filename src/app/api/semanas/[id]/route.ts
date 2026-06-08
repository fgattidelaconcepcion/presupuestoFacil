import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const payroll = await prisma.payroll.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      attendances: true,
      payments: { include: { employee: true } },
    },
  });

  if (!payroll)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Verificar que la semana pertenece a un proyecto del usuario autenticado
  if (payroll.project.userId !== userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.json(payroll);
}
