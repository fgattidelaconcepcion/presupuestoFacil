import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  budget: z.number().positive().optional(),
});

async function getProjectOrFail(id: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) return null;
  return project;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId },
    include: {
      employees: { where: { active: true }, orderBy: { createdAt: "asc" } },
      payrolls: {
        orderBy: { weekStart: "desc" },
        include: {
          payments: { include: { employee: true } },
        },
      },
      expenses: { orderBy: { date: "desc" } },
    },
  });

  if (!project)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getProjectOrFail(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const updateData: Record<string, unknown> = {
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    budget: data.budget ?? existing.budget,
  };

  if (data.budget !== undefined && data.budget !== existing.budget) {
    const diff = data.budget - existing.budget;
    updateData.budgetRemaining = Math.max(0, existing.budgetRemaining + diff);
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const existing = await getProjectOrFail(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.project.update({
    where: { id: params.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
