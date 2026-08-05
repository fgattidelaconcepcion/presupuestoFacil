import type { Project, MaterialOrder, MaterialItem } from "@/types";
import { LOGO_PDF } from "./logoBase64";

type Filtro = "todos" | "recibidos" | "pendientes";

function estadoItem(i: MaterialItem): "Completo" | "Parcial" | "Pendiente" {
  if (i.received || i.quantityReceived >= i.quantityOrdered) return "Completo";
  if (i.quantityReceived > 0) return "Parcial";
  return "Pendiente";
}

/**
 * PDF comparativo de materiales: pedido vs recibido, con faltantes.
 * @param filtro "todos" (default) | "recibidos" | "pendientes"
 */
export async function generarPDFMateriales(
  project: Project,
  orders: MaterialOrder[],
  filtro: Filtro = "todos",
) {
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
  const green = [22, 163, 74] as [number, number, number];
  const amber = [217, 119, 6] as [number, number, number];
  const red = [220, 38, 38] as [number, number, number];

  const num = (n: number) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  // Filtrar items según el modo elegido
  const filtrados = orders
    .map((o) => ({
      ...o,
      items: o.items.filter((i) => {
        const e = estadoItem(i);
        if (filtro === "recibidos") return e !== "Pendiente";
        if (filtro === "pendientes") return e !== "Completo";
        return true;
      }),
    }))
    .filter((o) => o.items.length > 0);

  const allItems = filtrados.flatMap((o) => o.items);
  const totalItems = allItems.length;
  const completos = allItems.filter((i) => estadoItem(i) === "Completo").length;
  const parciales = allItems.filter((i) => estadoItem(i) === "Parcial").length;
  const pendientes = allItems.filter(
    (i) => estadoItem(i) === "Pendiente",
  ).length;

  const titulo =
    filtro === "recibidos"
      ? "MATERIALES RECIBIDOS"
      : filtro === "pendientes"
        ? "MATERIALES PENDIENTES"
        : "PEDIDO DE MATERIALES";
  const chipColor =
    filtro === "recibidos" ? green : filtro === "pendientes" ? red : orange;

  // ── Header ──────────────────────────────────────────────
  doc.setFillColor(...blue);
  doc.rect(0, 0, pageW, 45, "F");
  doc.setFillColor(...orange);
  doc.rect(0, 43, pageW, 3, "F");

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

  doc.setFillColor(...chipColor);
  doc.roundedRect(pageW - 60, 9, 48, 12, 2, 2, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(titulo, pageW - 36, 16.5, { align: "center" });

  // ── Info de la obra ─────────────────────────────────────
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

  // ── Tarjeta resumen ─────────────────────────────────────
  doc.setFillColor(...gray50);
  doc.roundedRect(14, y, pageW - 28, 24, 3, 3, "F");
  doc.setDrawColor(...gray200);
  doc.roundedRect(14, y, pageW - 28, 24, 3, 3, "S");

  const cols: [string, string, [number, number, number]][] = [
    ["ITEMS", String(totalItems), dark],
    ["COMPLETOS", String(completos), green],
    ["PARCIALES", String(parciales), amber],
    ["PENDIENTES", String(pendientes), red],
  ];
  const colW = (pageW - 28) / 4;
  cols.forEach(([label, value, color], idx) => {
    const x = 14 + colW * idx + 6;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, y + 8);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(value, x, y + 18);
    if (idx > 0) {
      doc.setDrawColor(...gray200);
      doc.line(14 + colW * idx, y + 4, 14 + colW * idx, y + 20);
    }
  });
  y += 32;

  // ── Tablas por pedido ───────────────────────────────────
  if (filtrados.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("No hay materiales para mostrar con este filtro.", 14, y);
  }

  filtrados.forEach((order) => {
    const recibidosOrden = order.items.filter(
      (i) => estadoItem(i) === "Completo",
    ).length;

    if (y > pageH - 60) {
      doc.addPage();
      y = 20;
    }

    // Encabezado del pedido
    doc.setFillColor(...blue);
    doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "F");
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(order.name, 19, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(186, 207, 255);
    const meta = [
      fmtDate(order.orderDate),
      order.supplier ? `Proveedor: ${order.supplier}` : null,
      `${recibidosOrden}/${order.items.length} completos`,
    ]
      .filter(Boolean)
      .join("   ·   ");
    doc.text(meta, 19, y + 11);
    y += 17;

    const head = [
      ["#", "Material", "Unidad", "Pedido", "Recibido", "Falta", "Estado"],
    ];
    const body = order.items.map((i, idx) => {
      const falta = Math.max(0, i.quantityOrdered - i.quantityReceived);
      return [
        String(idx + 1),
        i.notes ? `${i.name}\n${i.notes}` : i.name,
        i.unit,
        num(i.quantityOrdered),
        num(i.quantityReceived),
        falta > 0 ? num(falta) : "—",
        estadoItem(i),
      ];
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: white,
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 8.5, textColor: dark, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: gray50 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { halign: "left" },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 20, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 16, halign: "right" },
        6: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 6) {
          const v = String(data.cell.raw);
          if (v === "Completo") data.cell.styles.textColor = green;
          else if (v === "Parcial") data.cell.styles.textColor = amber;
          else data.cell.styles.textColor = red;
        }
        if (data.section === "body" && data.column.index === 5) {
          if (String(data.cell.raw) !== "—") {
            data.cell.styles.textColor = red;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  });

  // ── Resumen de faltantes ────────────────────────────────
  const faltantes = allItems
    .filter((i) => i.quantityOrdered - i.quantityReceived > 0)
    .map((i) => ({
      name: i.name,
      unit: i.unit,
      falta: i.quantityOrdered - i.quantityReceived,
      pedido: i.quantityOrdered,
      recibido: i.quantityReceived,
    }));

  if (faltantes.length > 0 && filtro !== "recibidos") {
    if (y > pageH - 50) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...red);
    doc.text("Lo que falta que llegue", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Material", "Pedido", "Recibido", "Falta"]],
      body: faltantes.map((f) => [
        f.name,
        `${num(f.pedido)} ${f.unit}`,
        `${num(f.recibido)} ${f.unit}`,
        `${num(f.falta)} ${f.unit}`,
      ]),
      headStyles: {
        fillColor: red,
        textColor: white,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 8.5, textColor: dark, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { halign: "left" },
        1: { cellWidth: 28, halign: "right" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Footer en todas las páginas ─────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
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
    doc.text(
      `${new Date().toLocaleDateString("es-AR")}   ·   Pág. ${p}/${pages}`,
      pageW - 14,
      fY + 2,
      { align: "right" },
    );
  }

  const sufijo =
    filtro === "recibidos"
      ? "recibidos"
      : filtro === "pendientes"
        ? "pendientes"
        : "materiales";

  doc.save(`EasyPlaster-${project.name.replace(/\s+/g, "-")}-${sufijo}.pdf`);
}
