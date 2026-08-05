import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1, "El material necesita un nombre"),
  unit: z.string().min(1).max(20).default("un"),
  quantityOrdered: z.number().positive("La cantidad debe ser mayor a 0"),
  notes: z.string().max(300).nullable().optional(),
});

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1, "El pedido necesita un nombre"),
  supplier: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  orderDate: z.string().optional(),
  items: z.array(itemSchema).optional(),
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

  const orders = await prisma.materialOrder.findMany({
    where: { projectId },
    include: { items: { orderBy: { createdAt: "asc" } } },
    orderBy: { orderDate: "desc" },
  });

  return NextResponse.json(orders);
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

  const { projectId, name, supplier, notes, orderDate, items } = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const order = await prisma.materialOrder.create({
    data: {
      projectId,
      name,
      supplier: supplier || null,
      notes: notes || null,
      orderDate: orderDate ? new Date(orderDate) : new Date(),
      status: "pending",
      items: items?.length
        ? {
            create: items.map((i) => ({
              name: i.name,
              unit: i.unit || "un",
              quantityOrdered: i.quantityOrdered,
              quantityReceived: 0,
              received: false,
              notes: i.notes || null,
            })),
          }
        : undefined,
    },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(order, { status: 201 });
}
