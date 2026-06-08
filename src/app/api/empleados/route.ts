import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  projectId: z.string(),
  paymentType: z.enum(['daily', 'sqm']).default('daily'),
  dailyRate: z.number().optional(),
  sqmRate: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const body = await req.json();
  const { name, projectId, paymentType, dailyRate, sqmRate } = schema.parse(body);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const employee = await prisma.employee.create({
    data: { name, projectId, paymentType, dailyRate: dailyRate ?? 0, sqmRate: sqmRate ?? null },
  });
  return NextResponse.json(employee, { status: 201 });
}


