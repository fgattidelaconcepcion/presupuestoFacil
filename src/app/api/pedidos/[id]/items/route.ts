import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrderOwned, recalcOrderStatus } from "@/lib/materiales";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "El material necesita un nombre"),
  unit: z.string().min(1).max(20).default("un"),
  quantityOrdered: z.number().positive("La cantidad debe ser mayor a 0"),
  notes: z.string().max(300).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const owned = await getOrderOwned(params.id, userId);
  if (!owned)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );

  const { name, unit, quantityOrdered, notes } = parsed.data;

  const item = await prisma.materialItem.create({
    data: {
      orderId: params.id,
      name,
      unit: unit || "un",
      quantityOrdered,
      quantityReceived: 0,
      received: false,
      notes: notes || null,
    },
  });

  await recalcOrderStatus(params.id);
  return NextResponse.json(item, { status: 201 });
}
