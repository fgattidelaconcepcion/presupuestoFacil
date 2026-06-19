import type { Project, Expense } from "@/types";
import { LOGO_PDF } from "./logoBase64";

export async function generarPDFGastos(project: Project, expenses: Expense[]) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const blue = [30, 64, 175] as [number, number, number];
  const orange = [234, 88, 12] as [number, number, number];
  const gray50 = [248, 250, 252] as [number, number, number];
  const gray200 = [226, 232, 240] as [number, number, number];
  const dark = [15, 23, 42] as [number, number, number];
  const white = [255, 255, 255] as [number, number, number];
  const red = [220, 38, 38] as [number, number, number];

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

  // Header
  doc.setFillColor(...blue);
  doc.rect(0, 0, pageW, 45, "F");
  doc.setFillColor(...orange);
  doc.rect(0, 43, pageW, 3, "F");

  // Logo de la app: caja blanca redondeada + ícono EasyPlaster
  doc.setFillColor(...white);
  doc.roundedRect(12, 7, 28, 28, 4, 4, "F");
  doc.addImage(LOGO_PDF, "JPEG", 14.5, 9.5, 23, 23);

  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("EasyPlaster", 46, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(186, 207, 255);
  doc.text("Steel Framing · Control de Obras y Personal", 46, 25);

  doc.setFillColor(...red);
  doc.roundedRect(pageW - 52, 9, 40, 12, 2, 2, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("GASTOS EXTRAS", pageW - 32, 16.5, { align: "center" });

  // Project info
  let y = 55;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(project.name, 14, y);
  if (project.description) {
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(project.description, 14, y);
  }
  y += 8;

  // Summary card
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  doc.setFillColor(...gray50);
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, "F");
  doc.setDrawColor(...gray200);
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, "S");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("CANTIDAD DE GASTOS", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...dark);
  doc.text(`${expenses.length}`, 20, y + 16);

  doc.setDrawColor(...gray200);
  doc.line(pageW / 2, y + 3, pageW / 2, y + 19);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL GASTOS EXTRAS", pageW / 2 + 6, y + 7);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...red);
  doc.text(fmt(totalExpenses), pageW / 2 + 6, y + 16);
  y += 30;

  // Budget summary
  doc.setFillColor(...blue);
  doc.roundedRect(14, y, pageW - 28, 18, 3, 3, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("RESUMEN PRESUPUESTO", 20, y + 7);
  const spent = project.budget - project.budgetRemaining;
  const pct = ((project.budgetRemaining / project.budget) * 100).toFixed(1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(186, 207, 255);
  doc.text(
    `Total: ${fmt(project.budget)}   ·   Gastado: ${fmt(spent)}   ·   Restante: ${fmt(project.budgetRemaining)} (${pct}%)`,
    20,
    y + 14,
  );
  y += 26;

  // Table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Detalle de gastos extras", 14, y);
  y += 4;

  const head = [["#", "Fecha", "Descripción", "Monto"]];
  const body = expenses.map((e, i) => [
    String(i + 1),
    fmtDate(e.date),
    e.description,
    fmt(e.amount),
  ]);
  const foot = [["", "", "TOTAL", fmt(totalExpenses)]];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    headStyles: {
      fillColor: blue,
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

  // Footer
  const fY = pageH - 10;
  doc.setFillColor(...blue);
  doc.rect(0, fY - 4, pageW, 14, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(186, 207, 255);
  doc.text(
    "EasyPlaster Steel Framing · Sistema de gestión de obras",
    14,
    fY + 2,
  );
  doc.text(new Date().toLocaleDateString("es-AR"), pageW - 14, fY + 2, {
    align: "right",
  });

  doc.save(
    `EasyPlaster-${project.name.replace(/\s+/g, "-")}-gastos-extras.pdf`,
  );
}
