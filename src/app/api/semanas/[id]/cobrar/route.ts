import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const payroll = await prisma.payroll.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      attendances: true,
      payments: true,
    },
  });

  if (!payroll) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (payroll.project.userId !== userId)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (payroll.status === 'closed')
    return NextResponse.json({ error: 'Esta semana ya fue cobrada' }, { status: 400 });

  // Get all active employees for this project
  const employees = await prisma.employee.findMany({
    where: { projectId: payroll.projectId, active: true },
  });

  // Calculate payments based on attendance
  const paymentData = employees.map((emp) => {
    const daysWorked = payroll.attendances.filter(
      (a) => a.employeeId === emp.id && a.present
    ).length;
    const amount = daysWorked * emp.dailyRate;
    return { payrollId: payroll.id, employeeId: emp.id, daysWorked, amount };
  });

  const totalPaid = paymentData.reduce((sum, p) => sum + p.amount, 0);

  // Delete old payments if re-calculating
  await prisma.payment.deleteMany({ where: { payrollId: payroll.id } });

  // Create payments and close payroll in transaction
  const result = await prisma.$transaction([
    ...paymentData.map((p) => prisma.payment.create({ data: p })),
    prisma.payroll.update({
      where: { id: payroll.id },
      data: { status: 'closed', totalPaid },
    }),
    prisma.project.update({
      where: { id: payroll.projectId },
      data: { budgetRemaining: { decrement: totalPaid } },
    }),
  ]);

  return NextResponse.json({ ok: true, totalPaid, payments: paymentData });
}
