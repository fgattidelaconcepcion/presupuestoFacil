import type { Project, Payroll, Attendance } from ''@/types';

const DAYS: { key: string; label: string }[] = [
  { key: 'lun', label: 'Lunes' },
  { key: 'mar', label: 'Martes' },
  { key: 'mie', label: 'MiÃ©rcoles' },
  { key: 'jue', label: 'Jueves' },
  { key: 'vie', label: 'Viernes' },
  { key: 'sab', label: 'SÃ¡bado' },
];

function getDayDate(weekStart: string, dayIndex: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export async function generarPDF(
  project: Project,
  payroll: Payroll,
  attendanceList: Attendance[]
) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const blue    = [30, 64, 175]   as [number, number, number];
  const orange  = [234, 88, 12]   as [number, number, number];
  const gray50  = [248, 250, 252] as [number, number, number];
  const gray200 = [226, 232, 240] as [number, number, number];
  const dark    = [15, 23, 42]    as [number, number, number];
  const white   = [255, 255, 255] as [number, number, number];

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  // Header
  doc.setFillColor(...blue);
  doc.rect(0, 0, pageW, 45, 'F');
  doc.setFillColor(...orange);
  doc.rect(0, 43, pageW, 3, 'F');

  doc.setFillColor(...white);
  doc.roundedRect(12, 7, 28, 28, 4, 4, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...blue);
  doc.text('EASY', 17, 19); doc.text('PLASTER', 14.5, 25);
  doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.text('Steel Framing', 15, 30);

  doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('EasyPlaster', 46, 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(186, 207, 255);
  doc.text('Steel Framing Â· Control de Obras y Personal', 46, 25);

  doc.setFillColor(...orange);
  doc.roundedRect(pageW - 52, 9, 40, 12, 2, 2, 'F');
  doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('LIQUIDACIÃ“N SEMANAL', pageW - 32, 16.5, { align: 'center' });

  // Project info
  let y = 55;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text(project.name, 14, y);
  if (project.description) { y += 5; doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text(project.description, 14, y); }
  y += 8;

  const weekStart = new Date(payroll.weekStart).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const weekEnd   = new Date(payroll.weekEnd).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  doc.setFillColor(...gray50);
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, 'F');
  doc.setDrawColor(...gray200); doc.roundedRect(14, y, pageW - 28, 22, 3, 3, 'S');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
  doc.text('PERÃODO', 20, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark);
  doc.text(`${weekStart}  â†’  ${weekEnd}`, 20, y + 15);
  doc.setDrawColor(...gray200); doc.line(pageW / 2, y + 3, pageW / 2, y + 19);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PAGADO', pageW / 2 + 6, y + 7);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...orange);
  doc.text(fmt(payroll.totalPaid), pageW / 2 + 6, y + 16);
  y += 30;

  // Budget summary
  doc.setFillColor(...blue); doc.roundedRect(14, y, pageW - 28, 18, 3, 3, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
  doc.text('RESUMEN PRESUPUESTO', 20, y + 7);
  const spent = project.budget - project.budgetRemaining;
  const pct = ((project.budgetRemaining / project.budget) * 100).toFixed(1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(186, 207, 255);
  doc.text(`Total: ${fmt(project.budget)}   Â·   Gastado: ${fmt(spent)}   Â·   Restante: ${fmt(project.budgetRemaining)} (${pct}%)`, 20, y + 14);
  y += 26;

  // Attendance table
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text('Detalle de asistencia y pagos', 14, y);
  y += 4;

  const dayHeaders = DAYS.map((d, i) => `${d.label}\n${getDayDate(payroll.weekStart, i)}`);
  const head = [['Empleado', 'Tipo', ...dayHeaders, 'DÃ­as/mÂ²', 'Total']];

  const body = (payroll.payments ?? []).map(p => {
    const dayCells = DAYS.map(d => {
      const att = attendanceList.find(a => a.employeeId === p.employeeId && a.day === d.key);
      if (!att || !att.present) return 'â€“';
      if (p.employee?.paymentType === 'sqm' && att.metersWorked) return `âœ“\n${att.metersWorked}mÂ²`;
      return 'âœ“';
    });
    const tipo = p.employee?.paymentType === 'sqm' ? 'Por mÂ²' : 'Por dÃ­a';
    const diasOMetros = p.employee?.paymentType === 'sqm'
      ? `${p.metersTotal?.toFixed(1)}mÂ²`
      : `${p.daysWorked}d`;
    return [p.employee?.name ?? 'â€“', tipo, ...dayCells, diasOMetros, fmt(p.amount)];
  });

  const foot = [['', '', '', '', '', '', '', '', 'TOTAL', fmt(payroll.totalPaid)]];

  autoTable(doc, {
    startY: y, head, body, foot,
    headStyles: { fillColor: blue, textColor: white, fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 3 },
    footStyles: { fillColor: orange, textColor: white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: dark, halign: 'center' },
    alternateRowStyles: { fillColor: gray50 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 16, fontSize: 7 },
      2: { cellWidth: 14 }, 3: { cellWidth: 14 }, 4: { cellWidth: 14 },
      5: { cellWidth: 14 }, 6: { cellWidth: 14 }, 7: { cellWidth: 14 },
      8: { cellWidth: 14, fontStyle: 'bold' },
      9: { cellWidth: 22, fontStyle: 'bold', halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index >= 2 && data.column.index <= 7) {
        const val = data.cell.text[0];
        if (val === 'âœ“' || val.startsWith('âœ“')) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
        else { data.cell.styles.textColor = [203, 213, 225]; }
      }
    },
  });

  // Signatures
  const sigY = (doc as any).lastAutoTable.finalY + 14;
  if (sigY < pageH - 40) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
    doc.text('FIRMAS DE CONFORMIDAD', 14, sigY);
    const sigW = (pageW - 42) / Math.min(payroll.payments?.length ?? 1, 4);
    (payroll.payments ?? []).slice(0, 4).forEach((p, i) => {
      const sx = 14 + i * (sigW + 4); const sy = sigY + 8;
      doc.setDrawColor(...gray200); doc.line(sx, sy + 14, sx + sigW - 2, sy + 14);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...dark);
      doc.text(p.employee?.name ?? '', sx + (sigW - 2) / 2, sy + 19, { align: 'center' });
      doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(fmt(p.amount), sx + (sigW - 2) / 2, sy + 24, { align: 'center' });
    });
  }

  // Footer
  const fY = pageH - 10;
  doc.setFillColor(...blue); doc.rect(0, fY - 4, pageW, 14, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(186, 207, 255);
  doc.text('EasyPlaster Steel Framing Â· Sistema de gestiÃ³n de obras', 14, fY + 2);
  doc.text(new Date().toLocaleDateString('es-AR'), pageW - 14, fY + 2, { align: 'right' });

  const label = new Date(payroll.weekStart).toLocaleDateString('es-AR').replace(/\//g, '-');
  doc.save(`EasyPlaster-${project.name.replace(/\s+/g, '-')}-semana-${label}.pdf`);
}

