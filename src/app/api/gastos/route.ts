import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string().min(1),
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  date: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );

  const { projectId, description, amount, date } = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (project.budgetRemaining < amount)
    return NextResponse.json(
      {
        error: `Presupuesto insuficiente. Disponible: $${project.budgetRemaining.toFixed(2)}`,
      },
      { status: 400 },
    );

  const expense = await prisma.$transaction(async (tx) => {
    const e = await tx.expense.create({
      data: {
        projectId,
        description,
        amount,
        date: date ? new Date(date) : new Date(),
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { budgetRemaining: { decrement: amount } },
    });
    return e;
  });

  return NextResponse.json(expense, { status: 201 });
}
