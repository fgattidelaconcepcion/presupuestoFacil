import type { Project, Payroll, Expense, Employee } from "@/types";

interface EmployeeSummary {
  employee: Employee;
  totalAmount: number;
  totalDays: number;
  totalMeters: number;
}

export async function generarPDFBalance(
  project: Project & {
    employees: Employee[];
    payrolls: Payroll[];
    expenses: Expense[];
  },
) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const blue = [30, 64, 175] as [number, number, number];
  const orange = [234, 88, 12] as [number, number, number];
  const green = [22, 163, 74] as [number, number, number];
  const red = [220, 38, 38] as [number, number, number];
  const gray50 = [248, 250, 252] as [number, number, number];
  const gray200 = [226, 232, 240] as [number, number, number];
  const dark = [15, 23, 42] as [number, number, number];
  const white = [255, 255, 255] as [number, number, number];

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  // Calculate employee summaries from all closed payrolls
  const closedPayrolls = project.payrolls.filter((p) => p.status === "closed");
  const empMap: Record<string, EmployeeSummary> = {};

  for (const payroll of closedPayrolls) {
    for (const payment of payroll.payments ?? []) {
      const emp = payment.employee;
      if (!emp) continue;
      if (!empMap[emp.id]) {
        empMap[emp.id] = {
          employee: emp,
          totalAmount: 0,
          totalDays: 0,
          totalMeters: 0,
        };
      }
      empMap[emp.id].totalAmount += payment.amount;
      empMap[emp.id].totalDays += payment.daysWorked;
      empMap[emp.id].totalMeters += payment.metersTotal ?? 0;
    }
  }

  const empSummaries = Object.values(empMap).sort((a, b) =>
    a.employee.name.localeCompare(b.employee.name),
  );

  const totalEmployeeCost = empSummaries.reduce((s, e) => s + e.totalAmount, 0);
  const totalExpenses = project.expenses.reduce((s, e) => s + e.amount, 0);
  const totalSpent = totalEmployeeCost + totalExpenses;
  const budgetUsedPct = ((totalSpent / project.budget) * 100).toFixed(1);

  // ─── HEADER ───────────────────────────────────────────────────
  doc.setFillColor(...blue);
  doc.rect(0, 0, pageW, 45, "F");
  doc.setFillColor(...orange);
  doc.rect(0, 43, pageW, 3, "F");

  doc.setFillColor(...white);
  doc.roundedRect(12, 7, 28, 28, 4, 4, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...blue);
  doc.text("EASY", 17, 19);
  doc.text("PLASTER", 14.5, 25);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.text("Steel Framing", 15, 30);

  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("EasyPlaster", 46, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(186, 207, 255);
  doc.text("Steel Framing · Control de Obras y Personal", 46, 25);

  doc.setFillColor(...green);
  doc.roundedRect(pageW - 56, 9, 44, 12, 2, 2, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("BALANCE FINAL DE OBRA", pageW - 34, 16.5, { align: "center" });

  // ─── PROJECT NAME ─────────────────────────────────────────────
  let y = 55;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(project.name, 14, y);

  doc.setFillColor(...green);
  doc.roundedRect(pageW - 44, y - 6, 30, 8, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("OBRA FINALIZADA", pageW - 29, y - 0.5, { align: "center" });

  if (project.description) {
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(project.description, 14, y);
  }
  y += 10;

  // ─── RESUMEN GENERAL ─────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Resumen general", 14, y);
  y += 5;

  const colW = (pageW - 28 - 8) / 3;

  // Card 1: Presupuesto total
  doc.setFillColor(...blue);
  doc.roundedRect(14, y, colW, 24, 3, 3, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(186, 207, 255);
  doc.text("PRESUPUESTO TOTAL", 14 + colW / 2, y + 7, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text(fmt(project.budget), 14 + colW / 2, y + 16, { align: "center" });

  // Card 2: Total gastado
  doc.setFillColor(...orange);
  doc.roundedRect(14 + colW + 4, y, colW, 24, 3, 3, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 220, 200);
  doc.text("TOTAL GASTADO", 14 + colW + 4 + colW / 2, y + 7, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text(fmt(totalSpent), 14 + colW + 4 + colW / 2, y + 16, {
    align: "center",
  });
  doc.setFontSize(7);
  doc.text(
    `${budgetUsedPct}% del presupuesto`,
    14 + colW + 4 + colW / 2,
    y + 21,
    { align: "center" },
  );

  // Card 3: Saldo restante
  const saldoColor = project.budgetRemaining >= 0 ? green : red;
  doc.setFillColor(...saldoColor);
  doc.roundedRect(14 + (colW + 4) * 2, y, colW, 24, 3, 3, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 255, 220);
  doc.text("SALDO FINAL", 14 + (colW + 4) * 2 + colW / 2, y + 7, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text(
    fmt(project.budgetRemaining),
    14 + (colW + 4) * 2 + colW / 2,
    y + 16,
    { align: "center" },
  );

  y += 32;

  // Sub-totals row
  doc.setFillColor(...gray50);
  doc.roundedRect(14, y, pageW - 28, 18, 3, 3, "F");
  doc.setDrawColor(...gray200);
  doc.roundedRect(14, y, pageW - 28, 18, 3, 3, "S");

  const halfW = (pageW - 28) / 2;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("COSTO PERSONAL (EMPLEADOS)", 14 + halfW / 2, y + 6, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(fmt(totalEmployeeCost), 14 + halfW / 2, y + 14, { align: "center" });

  doc.setDrawColor(...gray200);
  doc.line(14 + halfW, y + 2, 14 + halfW, y + 16);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("GASTOS EXTRAS / MATERIALES", 14 + halfW + halfW / 2, y + 6, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(fmt(totalExpenses), 14 + halfW + halfW / 2, y + 14, {
    align: "center",
  });

  y += 26;

  // ─── TABLA EMPLEADOS ─────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Detalle por empleado", 14, y);
  y += 4;

  const empHead = [
    [
      "Empleado",
      "Tipo de pago",
      "Días trabajados",
      "Metros trabajados",
      "Total cobrado",
    ],
  ];
  const empBody = empSummaries.map((s) => [
    s.employee.name,
    s.employee.paymentType === "sqm" ? "Por m²" : "Por día",
    s.employee.paymentType === "sqm" ? "–" : `${s.totalDays}`,
    s.employee.paymentType === "sqm" ? `${s.totalMeters.toFixed(1)} m²` : "–",
    fmt(s.totalAmount),
  ]);
  const empFoot = [["", "", "", "TOTAL EMPLEADOS", fmt(totalEmployeeCost)]];

  autoTable(doc, {
    startY: y,
    head: empHead,
    body: empBody,
    foot: empFoot,
    headStyles: {
      fillColor: blue,
      textColor: white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 3,
    },
    footStyles: {
      fillColor: blue,
      textColor: white,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: dark, halign: "center" },
    alternateRowStyles: { fillColor: gray50 },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      4: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ─── TABLA GASTOS EXTRAS ─────────────────────────────────────
  if (project.expenses.length > 0) {
    // Check if we need a new page
    if (y > pageH - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Detalle de gastos extras", 14, y);
    y += 4;

    const expHead = [["#", "Fecha", "Descripción", "Monto"]];
    const expBody = [...project.expenses]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e, i) => [
        String(i + 1),
        fmtDate(e.date),
        e.description,
        fmt(e.amount),
      ]);
    const expFoot = [["", "", "TOTAL GASTOS EXTRAS", fmt(totalExpenses)]];

    autoTable(doc, {
      startY: y,
      head: expHead,
      body: expBody,
      foot: expFoot,
      headStyles: {
        fillColor: red,
        textColor: white,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        cellPadding: 3,
      },
      footStyles: {
        fillColor: red,
        textColor: white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: dark },
      alternateRowStyles: { fillColor: gray50 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 26, halign: "center" },
        2: { halign: "left" },
        3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── HISTORIAL DE SEMANAS ─────────────────────────────────────
  if (closedPayrolls.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Historial de semanas pagadas", 14, y);
    y += 4;

    const weekHead = [["Semana (inicio)", "Semana (fin)", "Total pagado"]];
    const weekBody = closedPayrolls.map((p) => [
      fmtDate(p.weekStart),
      fmtDate(p.weekEnd),
      p.totalPaid > 0 ? fmt(p.totalPaid) : "Semana libre",
    ]);
    const weekFoot = [["", "TOTAL SEMANAS", fmt(totalEmployeeCost)]];

    autoTable(doc, {
      startY: y,
      head: weekHead,
      body: weekBody,
      foot: weekFoot,
      headStyles: {
        fillColor: blue,
        textColor: white,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        cellPadding: 3,
      },
      footStyles: {
        fillColor: orange,
        textColor: white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: dark, halign: "center" },
      alternateRowStyles: { fillColor: gray50 },
      columnStyles: {
        2: { fontStyle: "bold", halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // ─── FOOTER ───────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const fY = pageH - 10;
    doc.setFillColor(...blue);
    doc.rect(0, fY - 4, pageW, 14, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(186, 207, 255);
    doc.text(
      `EasyPlaster Steel Framing · Balance Final · ${project.name}`,
      14,
      fY + 2,
    );
    doc.text(
      `Pág. ${i}/${totalPages}  ·  ${new Date().toLocaleDateString("es-AR")}`,
      pageW - 14,
      fY + 2,
      { align: "right" },
    );
  }

  doc.save(
    `EasyPlaster-${project.name.replace(/\s+/g, "-")}-balance-final.pdf`,
  );
}
