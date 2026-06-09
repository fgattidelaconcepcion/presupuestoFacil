import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  payrollId: z.string().min(1),
  employeeId: z.string().min(1),
  day: z.string().min(1),
  present: z.boolean(),
  metersWorked: z.number().nonnegative().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );
  }
  const { payrollId, employeeId, day, present, metersWorked } = parsed.data;

  // La semana debe pertenecer a una obra del usuario
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { project: true },
  });
  if (!payroll || payroll.project.userId !== userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // El empleado debe pertenecer a esa misma obra
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, projectId: payroll.projectId },
  });
  if (!employee) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const attendance = await prisma.attendance.upsert({
    where: { payrollId_employeeId_day: { payrollId, employeeId, day } },
    update: { present, metersWorked: metersWorked ?? null },
    create: {
      payrollId,
      employeeId,
      day,
      present,
      metersWorked: metersWorked ?? null,
    },
  });

  return NextResponse.json(attendance);
}
