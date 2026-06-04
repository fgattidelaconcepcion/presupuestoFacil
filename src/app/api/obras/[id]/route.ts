import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getProjectOrFail(id: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) return null;
  return project;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId },
    include: {
      employees: { where: { active: true }, orderBy: { createdAt: 'asc' } },
      payrolls: {
        orderBy: { weekStart: 'desc' },
        include: {
          payments: { include: { employee: true } },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getProjectOrFail(params.id, userId);
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const body = await req.json();
  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      budget: body.budget ?? existing.budget,
    },
  });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getProjectOrFail(params.id, userId);
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await prisma.project.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
