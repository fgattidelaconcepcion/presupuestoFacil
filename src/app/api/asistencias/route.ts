import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from ''@/lib/auth';
import { prisma } from ''@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { payrollId, employeeId, day, present, metersWorked } = await req.json();

  const attendance = await prisma.attendance.upsert({
    where: { payrollId_employeeId_day: { payrollId, employeeId, day } },
    update: { present, metersWorked: metersWorked ?? null },
    create: { payrollId, employeeId, day, present, metersWorked: metersWorked ?? null },
  });

  return NextResponse.json(attendance);
}

