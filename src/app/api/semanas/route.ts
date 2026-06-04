import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWeekDates } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const { projectId } = await req.json();

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Check if there's already an open payroll for this project
  const existing = await prisma.payroll.findFirst({
    where: { projectId, status: 'open' },
  });
  if (existing) return NextResponse.json(existing);

  const { weekStart, weekEnd } = getWeekDates();
  const payroll = await prisma.payroll.create({
    data: { projectId, weekStart, weekEnd, status: 'open' },
  });

  return NextResponse.json(payroll, { status: 201 });
}
