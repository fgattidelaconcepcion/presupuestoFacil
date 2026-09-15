import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAdvance } from "@/lib/cobros";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string().min(1),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  date: z.string().optional(),
  note: z.string().max(200).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "Falta projectId" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const cobros = await prisma.cobro.findMany({
    where: { projectId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(cobros);
}

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

  const { projectId, amount, date, note } = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const yaTiene = await prisma.cobro.count({ where: { projectId } });

  const cobro = await prisma.$transaction(async (tx) => {
    // Si la obra venía con un adelanto cargado a mano y todavía no tiene
    // cobros en la lista, ese monto se convierte en el primer cobro para
    // que no se pierda plata al pasar al historial.
    if (yaTiene === 0 && project.advanceAmount > 0) {
      await tx.cobro.create({
        data: {
          projectId,
          amount: project.advanceAmount,
          date: project.createdAt,
          note: "Adelanto inicial",
        },
      });
    }

    const creado = await tx.cobro.create({
      data: {
        projectId,
        amount,
        date: date ? new Date(date) : new Date(),
        note: note || null,
      },
    });

    await syncAdvance(tx, projectId);
    return creado;
  });

  return NextResponse.json(cobro, { status: 201 });
}
