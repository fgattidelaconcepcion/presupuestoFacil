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
    include: { project: true, attendances: true },
  });

  if (!payroll)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (payroll.project.userId !== userId)
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (payroll.status === "closed")
    return NextResponse.json(
      { error: "Esta semana ya fue cobrada" },
      { status: 400 },
    );

  const employees = await prisma.employee.findMany({
    where: { projectId: payroll.projectId, active: true },
  });

  const paymentData = employees.map((emp) => {
    const empAttendances = payroll.attendances.filter(
      (a) => a.employeeId === emp.id && a.present,
    );
    const daysWorked = empAttendances.length;
    let amount = 0;
    let metersTotal = 0;

    if (emp.paymentType === "sqm" && emp.sqmRate) {
      metersTotal = empAttendances.reduce(
        (sum, a) => sum + (a.metersWorked ?? 0),
        0,
      );
      amount = metersTotal * emp.sqmRate;
    } else {
      amount = daysWorked * emp.dailyRate;
    }

    return {
      payrollId: payroll.id,
      employeeId: emp.id,
      daysWorked,
      metersTotal,
      amount,
    };
  });

  const totalPaid = paymentData.reduce((sum, p) => sum + p.amount, 0);

  // Solo verificar presupuesto si hay algo que pagar
  if (totalPaid > 0 && payroll.project.budgetRemaining < totalPaid) {
    return NextResponse.json(
      {
        error: `Presupuesto insuficiente. Disponible: $${payroll.project.budgetRemaining.toFixed(2)}, requerido: $${totalPaid.toFixed(2)}`,
      },
      { status: 400 },
    );
  }

  await prisma.payment.deleteMany({ where: { payrollId: payroll.id } });

  // Si totalPaid es 0 (semana libre), solo cerrar la semana sin tocar el presupuesto
  await prisma.$transaction(async (tx) => {
    for (const p of paymentData.filter((p) => p.amount > 0)) {
      await tx.payment.create({ data: p });
    }
    await tx.payroll.update({
      where: { id: payroll.id },
      data: { status: "closed", totalPaid },
    });
    if (totalPaid > 0) {
      await tx.project.update({
        where: { id: payroll.projectId },
        data: { budgetRemaining: { decrement: totalPaid } },
      });
    }
  });

  return NextResponse.json({ ok: true, totalPaid, payments: paymentData });
}
