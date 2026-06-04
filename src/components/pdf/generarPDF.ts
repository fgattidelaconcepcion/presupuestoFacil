import type { Project, Payroll } from '@/types';

export async function generarPDF(project: Project, payroll: Payroll) {
  // Dynamic import to avoid SSR issues
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryBlue = [30, 58, 138] as [number, number, number];
  const accentOrange = [234, 88, 12] as [number, number, number];
  const lightGray = [248, 250, 252] as [number, number, number];
  const darkText = [30, 41, 59] as [number, number, number];

  const pageW = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, pageW, 40, 'F');

  // Orange accent bar
  doc.setFillColor(...accentOrange);
  doc.rect(0, 38, pageW, 3, 'F');

  // App name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESUPUESTO OBRA', 15, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Control de obras y personal', 15, 23);

  // Document title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('LIQUIDACIÓN SEMANAL', pageW - 15, 16, { align: 'right' });

  const fecha = new Date().toLocaleDateString('es-AR');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado: ${fecha}`, pageW - 15, 23, { align: 'right' });

  // Project info section
  let y = 52;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(project.name, 15, y);

  if (project.description) {
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(project.description, 15, y);
  }

  y += 8;

  // Week info
  const weekStart = new Date(payroll.weekStart).toLocaleDateString('es-AR');
  const weekEnd = new Date(payroll.weekEnd).toLocaleDateString('es-AR');

  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, pageW - 30, 18, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text('Período:', 20, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${weekStart} – ${weekEnd}`, 20, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Total pagado:', pageW / 2, y + 7);
  doc.setTextColor(...accentOrange);
  doc.setFontSize(12);
  doc.text(
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payroll.totalPaid),
    pageW / 2,
    y + 14
  );

  y += 26;

  // Budget summary
  doc.setFillColor(...primaryBlue);
  doc.roundedRect(15, y, pageW - 30, 22, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN PRESUPUESTO', 20, y + 7);

  const budgetUsed = project.budget - project.budgetRemaining;
  const budgetPct = ((project.budgetRemaining / project.budget) * 100).toFixed(1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(186, 230, 253);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  doc.text(`Presupuesto total: ${fmt(project.budget)}`, 20, y + 14);
  doc.text(`Gastado: ${fmt(budgetUsed)}   Restante: ${fmt(project.budgetRemaining)} (${budgetPct}%)`, 20, y + 20);

  y += 30;

  // Payments table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text('Detalle de pagos', 15, y);
  y += 5;

  const tableData = (payroll.payments ?? []).map((p) => [
    p.employee?.name ?? '-',
    fmt(p.employee?.dailyRate ?? 0),
    p.daysWorked.toString(),
    fmt(p.amount),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Empleado', 'Jornal/día', 'Días trabajados', 'Total a cobrar']],
    body: tableData,
    foot: [['', '', 'TOTAL', fmt(payroll.totalPaid)]],
    headStyles: {
      fillColor: primaryBlue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: accentOrange,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 9, textColor: darkText },
    alternateRowStyles: { fillColor: lightGray },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, finalY, pageW - 15, finalY);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Generado con Presupuesto Obra', 15, finalY + 5);
  doc.text(fecha, pageW - 15, finalY + 5, { align: 'right' });

  // Save
  const weekLabel = weekStart.replace(/\//g, '-');
  doc.save(`liquidacion-${project.name.replace(/\s+/g, '-')}-${weekLabel}.pdf`);
}
