import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payroll = await prisma.payroll.findUnique({
    where: { id: params.id },
    include: {
      attendances: true,
      payments: { include: { employee: true } },
    },
  });

  if (!payroll) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(payroll);
}
