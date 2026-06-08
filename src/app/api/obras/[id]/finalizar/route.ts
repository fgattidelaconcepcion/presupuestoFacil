import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const project = await prisma.project.findFirst({ where: { id: params.id, userId } });
  if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Close any open payroll
  await prisma.payroll.updateMany({ where: { projectId: params.id, status: 'open' }, data: { status: 'closed' } });

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: { status: 'finished' },
  });

  return NextResponse.json(updated);
}

