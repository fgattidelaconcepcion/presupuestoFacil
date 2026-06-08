import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWeekDates, getNextWeekDates } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const { projectId } = await req.json();

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Return existing open payroll if any
  const existing = await prisma.payroll.findFirst({ where: { projectId, status: 'open' } });
  if (existing) return NextResponse.json(existing);

  // Find last closed payroll to determine next week
  const lastClosed = await prisma.payroll.findFirst({
    where: { projectId, status: 'closed' },
    orderBy: { weekEnd: 'desc' },
  });

  let weekStart: Date, weekEnd: Date;

  if (lastClosed) {
    // Advance to the week after the last closed one
    const next = getNextWeekDates(new Date(lastClosed.weekEnd));
    weekStart = next.weekStart;
    weekEnd = next.weekEnd;
  } else {
    // First payroll â€” use current week
    const current = getWeekDates();
    weekStart = current.weekStart;
    weekEnd = current.weekEnd;
  }

  const payroll = await prisma.payroll.create({
    data: { projectId, weekStart, weekEnd, status: 'open' },
  });

  return NextResponse.json(payroll, { status: 201 });
}


