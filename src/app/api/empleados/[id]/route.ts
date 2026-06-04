import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const emp = await prisma.employee.findFirst({
    where: { id: params.id },
    include: { project: true },
  });
  if (!emp || emp.project.userId !== userId)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.employee.update({
    where: { id: params.id },
    data: {
      name: body.name ?? emp.name,
      dailyRate: body.dailyRate ?? emp.dailyRate,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const emp = await prisma.employee.findFirst({
    where: { id: params.id },
    include: { project: true },
  });
  if (!emp || emp.project.userId !== userId)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  await prisma.employee.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
