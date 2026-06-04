import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  budget: z.number().positive(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userId = (session.user as { id?: string }).id!;
  const projects = await prisma.project.findMany({
    where: { userId, active: true },
    include: { _count: { select: { employees: { where: { active: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    projects.map((p) => ({ ...p, employeeCount: p._count.employees }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userId = (session.user as { id?: string }).id!;
  const body = await req.json();
  const { name, description, budget } = createSchema.parse(body);

  const project = await prisma.project.create({
    data: { name, description, budget, budgetRemaining: budget, userId },
  });

  return NextResponse.json(project, { status: 201 });
}
