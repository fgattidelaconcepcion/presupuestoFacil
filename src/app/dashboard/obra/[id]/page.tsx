"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, DAYS_OF_WEEK } from "@/lib/utils";
import type {
  Project,
  Employee,
  Payroll,
  Attendance,
  Expense,
  Payment,
  MaterialOrder,
  MaterialItem,
  Cobro,
} from "@/types";
import { generarPDF } from "@/components/pdf/generarPDF";
import { generarPDFGastos } from "@/components/pdf/generarPDFGastos";
import { generarPDFBalance } from "@/components/pdf/generarPDFBalance";
import { generarPDFMateriales } from "@/components/pdf/generarPDFMateriales";

type Tab =
  | "asistencia"
  | "empleados"
  | "materiales"
  | "gastos"
  | "cobros"
  | "historial";

interface ProjectDetail extends Project {
  employees: Employee[];
  payrolls: (Payroll & { payments?: Payment[] })[];
  expenses: Expense[];
  materialOrders: MaterialOrder[];
  cobros: Cobro[];
}

const UNIDADES = ["un", "m", "m²", "m³", "kg", "bolsa", "chapa", "caja", "rollo", "lt"];

/** Convierte lo tipeado a número (acepta coma decimal). 0 si está vacío. */
function parseNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function itemEstado(i: MaterialItem): "completo" | "parcial" | "pendiente" {
  if (i.received || i.quantityReceived >= i.quantityOrdered) return "completo";
  if (i.quantityReceived > 0) return "parcial";
  return "pendiente";
}

interface EmpFormProps {
  form: {
    name: string;
    paymentType: "daily" | "sqm";
    dailyRate: string;
    sqmRate: string;
  };
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

export default function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("asistencia");
  const [currentPayroll, setCurrentPayroll] = useState<Payroll | null>(null);
  const [attendances, setAttendances] = useState<
    Record<string, Record<string, { present: boolean; meters?: number }>>
  >({});
  const [cobrandoSemana, setCobrandoSemana] = useState(false);
  const [cobrError, setCobrError] = useState("");
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({
    name: "",
    paymentType: "daily" as "daily" | "sqm",
    dailyRate: "",
    sqmRate: "",
  });
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState("");
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editEmpForm, setEditEmpForm] = useState({
    name: "",
    paymentType: "daily" as "daily" | "sqm",
    dailyRate: "",
    sqmRate: "",
  });
  const [editingObra, setEditingObra] = useState(false);
  const [obraForm, setObraForm] = useState({
    name: "",
    description: "",
    budget: "",
    advanceAmount: "",
  });
  const [obraLoading, setObraLoading] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Gastos extras state
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [gastoForm, setGastoForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [gastoLoading, setGastoLoading] = useState(false);
  const [gastoError, setGastoError] = useState("");
  const [editingGasto, setEditingGasto] = useState<Expense | null>(null);
  const [editGastoForm, setEditGastoForm] = useState({
    description: "",
    amount: "",
    date: "",
  });

  // ── Cobros state (plata que entrega el cliente) ───────
  const [showCobroForm, setShowCobroForm] = useState(false);
  const [cobroForm, setCobroForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [cobroLoading, setCobroLoading] = useState(false);
  const [cobroError, setCobroError] = useState("");
  const [editingCobro, setEditingCobro] = useState<Cobro | null>(null);
  const [editCobroForm, setEditCobroForm] = useState({
    amount: "",
    date: "",
    note: "",
  });

  // ── Materiales state ──────────────────────────────────
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [pedidoForm, setPedidoForm] = useState({
    name: "",
    supplier: "",
    orderDate: new Date().toISOString().split("T")[0],
  });
  const [pedidoLoading, setPedidoLoading] = useState(false);
  const [pedidoError, setPedidoError] = useState("");
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});
  const [addItemFor, setAddItemFor] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    quantityOrdered: "",
    unit: "un",
    unitPrice: "",
    notes: "",
  });
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState("");
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    name: "",
    quantityOrdered: "",
    quantityReceived: "",
    unit: "un",
    unitPrice: "",
    notes: "",
  });
  const [editingPedido, setEditingPedido] = useState<MaterialOrder | null>(
    null,
  );
  const [editPedidoForm, setEditPedidoForm] = useState({
    name: "",
    supplier: "",
    orderDate: "",
  });
  const [pdfFiltro, setPdfFiltro] = useState<
    "todos" | "recibidos" | "pendientes"
  >("todos");

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/obras/${id}`);
    if (!res.ok) {
      router.push("/dashboard");
      return;
    }
    const data: ProjectDetail = await res.json();
    setProject(data);
    setCurrentPayroll(data.payrolls.find((p) => p.status === "open") ?? null);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (!currentPayroll) return;
    fetch(`/api/semanas/${currentPayroll.id}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<
          string,
          Record<string, { present: boolean; meters?: number }>
        > = {};
        (data.attendances ?? []).forEach((a: Attendance) => {
          if (!map[a.employeeId]) map[a.employeeId] = {};
          map[a.employeeId][a.day] = {
            present: a.present,
            meters: a.metersWorked ?? undefined,
          };
        });
        setAttendances(map);
      });
  }, [currentPayroll]);

  async function openWeek() {
    if (!project) return;
    const res = await fetch("/api/semanas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    setCurrentPayroll(await res.json());
  }

  async function toggleAttendance(employeeId: string, day: string) {
    if (!currentPayroll) return;
    const cur = attendances[employeeId]?.[day];
    const newPresent = !(cur?.present ?? false);
    setAttendances((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] ?? {}),
        [day]: { present: newPresent, meters: cur?.meters },
      },
    }));
    await fetch("/api/asistencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payrollId: currentPayroll.id,
        employeeId,
        day,
        present: newPresent,
        metersWorked: cur?.meters ?? null,
      }),
    });
  }

  async function updateMeters(employeeId: string, day: string, meters: number) {
    if (!currentPayroll) return;
    const present = attendances[employeeId]?.[day]?.present ?? false;
    setAttendances((prev) => ({
      ...prev,
      [employeeId]: { ...(prev[employeeId] ?? {}), [day]: { present, meters } },
    }));
    await fetch("/api/asistencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payrollId: currentPayroll.id,
        employeeId,
        day,
        present,
        metersWorked: meters,
      }),
    });
  }

  async function cobrarSemana() {
    if (!currentPayroll) return;
    setCobrError("");
    setCobrandoSemana(true);
    const res = await fetch(`/api/semanas/${currentPayroll.id}/cobrar`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setCobrError(data.error ?? "Error");
      setCobrandoSemana(false);
      return;
    }
    await fetchProject();
    setCurrentPayroll(null);
    setAttendances({});
    setTab("historial");
    setCobrandoSemana(false);
  }

  async function reabrirSemana(payrollId: string) {
    const res = await fetch(`/api/semanas/${payrollId}/reabrir`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Error al reabrir la semana");
      return;
    }
    await fetchProject();
    setTab("asistencia");
  }

  async function finalizarObra() {
    if (!project) return;
    setFinalizando(true);
    await fetch(`/api/obras/${project.id}/finalizar`, { method: "POST" });
    await fetchProject();
    setFinalizando(false);
    setShowFinalizar(false);
  }

  async function addEmployee() {
    if (!project || !empForm.name) return;
    setEmpLoading(true);
    setEmpError("");
    const body: Record<string, unknown> = {
      name: empForm.name,
      projectId: project.id,
      paymentType: empForm.paymentType,
    };
    if (empForm.paymentType === "daily")
      body.dailyRate = parseFloat(empForm.dailyRate);
    else body.sqmRate = parseFloat(empForm.sqmRate);
    const res = await fetch("/api/empleados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setEmpLoading(false);
    if (!res.ok) {
      setEmpError(data.error ?? "Error");
      return;
    }
    setEmpForm({ name: "", paymentType: "daily", dailyRate: "", sqmRate: "" });
    setShowEmpForm(false);
    fetchProject();
  }

  async function saveEditEmployee() {
    if (!editingEmp) return;
    setEmpLoading(true);
    const body: Record<string, unknown> = {
      name: editEmpForm.name,
      paymentType: editEmpForm.paymentType,
    };
    if (editEmpForm.paymentType === "daily")
      body.dailyRate = parseFloat(editEmpForm.dailyRate);
    else body.sqmRate = parseFloat(editEmpForm.sqmRate);
    await fetch(`/api/empleados/${editingEmp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEmpLoading(false);
    setEditingEmp(null);
    fetchProject();
  }

  async function deleteEmployee(empId: string) {
    if (!confirm("¿Eliminar empleado?")) return;
    await fetch(`/api/empleados/${empId}`, { method: "DELETE" });
    fetchProject();
  }

  async function saveObra() {
    if (!project) return;
    setObraLoading(true);
    await fetch(`/api/obras/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: obraForm.name,
        description: obraForm.description,
        budget: parseNum(obraForm.budget),
        advanceAmount: parseNum(obraForm.advanceAmount),
      }),
    });
    setObraLoading(false);
    setEditingObra(false);
    fetchProject();
  }

  async function addGasto() {
    if (!project) return;
    setGastoLoading(true);
    setGastoError("");
    const res = await fetch("/api/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        description: gastoForm.description,
        amount: parseFloat(gastoForm.amount),
        date: gastoForm.date,
      }),
    });
    const data = await res.json();
    setGastoLoading(false);
    if (!res.ok) {
      setGastoError(data.error ?? "Error al guardar el gasto");
      return;
    }
    setGastoForm({
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowGastoForm(false);
    fetchProject();
  }

  /** Abre el modal de edición de un gasto extra con sus datos actuales. */
  function abrirEditarGasto(expense: Expense) {
    setEditingGasto(expense);
    setGastoError("");
    setEditGastoForm({
      description: expense.description,
      amount: String(expense.amount),
      date: new Date(expense.date).toISOString().split("T")[0],
    });
  }

  async function saveEditGasto() {
    if (!editingGasto) return;
    setGastoLoading(true);
    setGastoError("");
    const res = await fetch(`/api/gastos/${editingGasto.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editGastoForm.description,
        amount: parseFloat(editGastoForm.amount),
        date: editGastoForm.date,
      }),
    });
    const data = await res.json();
    setGastoLoading(false);
    if (!res.ok) {
      // Ej: "Presupuesto insuficiente" si sube el monto más de lo que queda.
      setGastoError(data.error ?? "Error al guardar el gasto");
      return;
    }
    setEditingGasto(null);
    fetchProject();
  }

  async function deleteGasto(gastoId: string) {
    if (!confirm("¿Eliminar este gasto extra?")) return;
    await fetch(`/api/gastos/${gastoId}`, { method: "DELETE" });
    fetchProject();
  }

  // ── Cobros ────────────────────────────────────────────
  async function addCobro() {
    if (!project || !cobroForm.amount) return;
    setCobroLoading(true);
    setCobroError("");
    const res = await fetch("/api/cobros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        amount: parseNum(cobroForm.amount),
        date: cobroForm.date,
        note: cobroForm.note || null,
      }),
    });
    const data = await res.json();
    setCobroLoading(false);
    if (!res.ok) {
      setCobroError(data.error ?? "Error al registrar el cobro");
      return;
    }
    setCobroForm({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setShowCobroForm(false);
    fetchProject();
  }

  async function saveCobro() {
    if (!editingCobro) return;
    setCobroLoading(true);
    setCobroError("");
    const res = await fetch(`/api/cobros/${editingCobro.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseNum(editCobroForm.amount),
        date: editCobroForm.date,
        note: editCobroForm.note || null,
      }),
    });
    const data = await res.json();
    setCobroLoading(false);
    if (!res.ok) {
      setCobroError(data.error ?? "Error al guardar el cobro");
      return;
    }
    setEditingCobro(null);
    fetchProject();
  }

  async function deleteCobro(cobroId: string) {
    if (!confirm("¿Eliminar este cobro?")) return;
    await fetch(`/api/cobros/${cobroId}`, { method: "DELETE" });
    fetchProject();
  }

  // ── Materiales ────────────────────────────────────────
  async function addPedido() {
    if (!project || !pedidoForm.name) return;
    setPedidoLoading(true);
    setPedidoError("");
    const res = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: pedidoForm.name,
        supplier: pedidoForm.supplier || null,
        orderDate: pedidoForm.orderDate,
      }),
    });
    const data = await res.json();
    setPedidoLoading(false);
    if (!res.ok) {
      setPedidoError(data.error ?? "Error al crear el pedido");
      return;
    }
    setPedidoForm({
      name: "",
      supplier: "",
      orderDate: new Date().toISOString().split("T")[0],
    });
    setShowPedidoForm(false);
    setOpenOrders((p) => ({ ...p, [data.id]: true }));
    setAddItemFor(data.id);
    await fetchProject();
  }

  async function savePedido() {
    if (!editingPedido) return;
    setPedidoLoading(true);
    await fetch(`/api/pedidos/${editingPedido.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editPedidoForm.name,
        supplier: editPedidoForm.supplier || null,
        orderDate: editPedidoForm.orderDate,
      }),
    });
    setPedidoLoading(false);
    setEditingPedido(null);
    fetchProject();
  }

  async function deletePedido(orderId: string) {
    if (!confirm("¿Eliminar este pedido y todos sus materiales?")) return;
    await fetch(`/api/pedidos/${orderId}`, { method: "DELETE" });
    fetchProject();
  }

  async function addItem(orderId: string) {
    if (!itemForm.name || !itemForm.quantityOrdered) return;
    setItemLoading(true);
    setItemError("");
    const res = await fetch(`/api/pedidos/${orderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: itemForm.name,
        unit: itemForm.unit || "un",
        quantityOrdered: parseNum(itemForm.quantityOrdered),
        unitPrice: parseNum(itemForm.unitPrice),
        notes: itemForm.notes || null,
      }),
    });
    const data = await res.json();
    setItemLoading(false);
    if (!res.ok) {
      setItemError(data.error ?? "Error al agregar el material");
      return;
    }
    setItemForm({
      name: "",
      quantityOrdered: "",
      unit: itemForm.unit,
      unitPrice: "",
      notes: "",
    });
    await fetchProject();
  }

  /** Optimistic update de un item dentro del state del proyecto. */
  function patchItemLocal(itemId: string, patch: Partial<MaterialItem>) {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            materialOrders: (prev.materialOrders ?? []).map((o) => ({
              ...o,
              items: o.items.map((i) =>
                i.id === itemId ? { ...i, ...patch } : i,
              ),
            })),
          }
        : prev,
    );
  }

  async function toggleItemRecibido(item: MaterialItem) {
    const nuevo = !(itemEstado(item) === "completo");
    patchItemLocal(item.id, {
      received: nuevo,
      quantityReceived: nuevo ? item.quantityOrdered : 0,
    });
    await fetch(`/api/materiales/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ received: nuevo }),
    });
    fetchProject();
  }

  async function setCantidadRecibida(item: MaterialItem, cantidad: number) {
    const q = Math.max(0, isNaN(cantidad) ? 0 : cantidad);
    patchItemLocal(item.id, {
      quantityReceived: q,
      received: q >= item.quantityOrdered && q > 0,
    });
    await fetch(`/api/materiales/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantityReceived: q }),
    });
    fetchProject();
  }

  async function saveEditItem() {
    if (!editingItem) return;
    setItemLoading(true);
    setItemError("");
    const res = await fetch(`/api/materiales/${editingItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editItemForm.name,
        unit: editItemForm.unit || "un",
        quantityOrdered: parseNum(editItemForm.quantityOrdered),
        quantityReceived: parseNum(editItemForm.quantityReceived),
        unitPrice: parseNum(editItemForm.unitPrice),
        notes: editItemForm.notes || null,
      }),
    });
    setItemLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItemError(data.error ?? "Error al guardar el material");
      return;
    }
    setEditingItem(null);
    fetchProject();
  }

  /** Abre el modal de editar material con los datos cargados. */
  function abrirEditItem(item: MaterialItem) {
    setEditingItem(item);
    setItemError("");
    setEditItemForm({
      name: item.name,
      quantityOrdered: String(item.quantityOrdered),
      quantityReceived: String(item.quantityReceived),
      unit: item.unit,
      unitPrice: item.unitPrice ? String(item.unitPrice) : "",
      notes: item.notes ?? "",
    });
  }

  async function deleteItem(itemId: string) {
    if (!confirm("¿Eliminar este material del pedido?")) return;
    await fetch(`/api/materiales/${itemId}`, { method: "DELETE" });
    fetchProject();
  }

  function calcEmpWeekTotal(emp: Employee): number {
    if (!attendances[emp.id]) return 0;
    if (emp.paymentType === "sqm" && emp.sqmRate) {
      return Object.values(attendances[emp.id]).reduce(
        (sum, a) => sum + (a.present ? (a.meters ?? 0) * emp.sqmRate! : 0),
        0,
      );
    }
    return (
      DAYS_OF_WEEK.filter((d) => attendances[emp.id]?.[d.key]?.present).length *
      emp.dailyRate
    );
  }

  function calcWeekTotal() {
    if (!project) return 0;
    return project.employees.reduce(
      (sum, emp) => sum + calcEmpWeekTotal(emp),
      0,
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  if (!project) return null;

  const budgetPct = Math.max(
    0,
    Math.min(100, (project.budgetRemaining / project.budget) * 100),
  );
  const weekTotal = calcWeekTotal();
  const isFinished = project.status === "finished";
  const totalExpenses = (project.expenses ?? []).reduce(
    (s, e) => s + e.amount,
    0,
  );

  const orders = project.materialOrders ?? [];
  const allMatItems = orders.flatMap((o) => o.items);

  // ── Plata: adelanto cobrado vs. gastado ──────────────────────────
  const totalMateriales = allMatItems.reduce(
    (s, i) => s + (i.unitPrice ?? 0) * i.quantityOrdered,
    0,
  );
  const gastado = project.budget - project.budgetRemaining;
  const totalPersonal = Math.max(0, gastado - totalExpenses - totalMateriales);
  /** Plata que el cliente ya entregó (suma de los cobros). */
  const cobrado = project.advanceAmount ?? 0;
  const cobros = project.cobros ?? [];
  /** Plata que realmente queda en mano (del adelanto). Puede ser negativa. */
  const disponible = cobrado - gastado;
  const faltaCobrar = Math.max(0, project.budget - cobrado);
  const consumoPct =
    cobrado > 0
      ? (gastado / cobrado) * 100
      : project.budget > 0
        ? (gastado / project.budget) * 100
        : 0;
  const barPct = Math.max(0, Math.min(100, consumoPct));
  const matPendientes = allMatItems.filter(
    (i) => itemEstado(i) !== "completo",
  ).length;
  const matCompletos = allMatItems.filter(
    (i) => itemEstado(i) === "completo",
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-800 truncate">
              {project.name}
            </h1>
            {isFinished && (
              <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full shrink-0">
                Finalizada
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-slate-400 truncate">
              {project.description}
            </p>
          )}
        </div>
        {!isFinished && (
          <button
            onClick={() => {
              setEditingObra(true);
              setObraForm({
                name: project.name,
                description: project.description ?? "",
                budget: project.budget.toString(),
                advanceAmount: String(project.advanceAmount ?? 0),
              });
            }}
            className="text-slate-400 hover:text-primary-600 p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ─── MODALS ─────────────────────────────────────────── */}
      {editingPedido && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-4">Editar pedido</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editPedidoForm.name}
                onChange={(e) =>
                  setEditPedidoForm((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Nombre del pedido"
              />
              <input
                type="text"
                value={editPedidoForm.supplier}
                onChange={(e) =>
                  setEditPedidoForm((p) => ({ ...p, supplier: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Proveedor (opcional)"
              />
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <p className="text-xs text-slate-500 leading-relaxed">
                  El precio no se carga acá: va en cada material del pedido (con
                  el lápiz del material o el botón{" "}
                  <span className="font-semibold text-primary-700">
                    + Poner precio
                  </span>
                  ).
                </p>
                {(() => {
                  const totalPedido = (editingPedido.items ?? []).reduce(
                    (sum, i) => sum + (i.unitPrice ?? 0) * i.quantityOrdered,
                    0,
                  );
                  return totalPedido > 0 ? (
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      Total del pedido: {formatCurrency(totalPedido)}
                    </p>
                  ) : null;
                })()}
              </div>
              <input
                type="date"
                value={editPedidoForm.orderDate}
                onChange={(e) =>
                  setEditPedidoForm((p) => ({
                    ...p,
                    orderDate: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingPedido(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={savePedido}
                  disabled={pedidoLoading || !editPedidoForm.name}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {pedidoLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCobro && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-1">Editar cobro</h3>
            <p className="text-xs text-slate-400 mb-4">
              El total cobrado se recalcula solo
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Monto
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={editCobroForm.amount}
                      onChange={(e) =>
                        setEditCobroForm((p) => ({
                          ...p,
                          amount: e.target.value,
                        }))
                      }
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={editCobroForm.date}
                    onChange={(e) =>
                      setEditCobroForm((p) => ({ ...p, date: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>
              </div>
              <input
                type="text"
                value={editCobroForm.note}
                onChange={(e) =>
                  setEditCobroForm((p) => ({ ...p, note: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                placeholder="Nota (opcional)"
              />
              {cobroError && <p className="text-red-500 text-xs">{cobroError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditingCobro(null);
                    setCobroError("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveCobro}
                  disabled={cobroLoading || !editCobroForm.amount}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {cobroLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingGasto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-1">Editar gasto extra</h3>
            <p className="text-xs text-slate-400 mb-4">
              El presupuesto restante se ajusta solo con la diferencia
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={editGastoForm.description}
                onChange={(e) =>
                  setEditGastoForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                placeholder="Descripción del gasto"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Monto
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={editGastoForm.amount}
                      onChange={(e) =>
                        setEditGastoForm((p) => ({
                          ...p,
                          amount: e.target.value,
                        }))
                      }
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={editGastoForm.date}
                    onChange={(e) =>
                      setEditGastoForm((p) => ({ ...p, date: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  />
                </div>
              </div>
              {gastoError && (
                <p className="text-red-500 text-xs">{gastoError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditingGasto(null);
                    setGastoError("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEditGasto}
                  disabled={
                    gastoLoading ||
                    !editGastoForm.description ||
                    !editGastoForm.amount
                  }
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {gastoLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-1">Editar material</h3>
            <p className="text-xs text-slate-400 mb-4">
              Ajustá lo pedido y lo que realmente llegó
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={editItemForm.name}
                onChange={(e) =>
                  setEditItemForm((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Material"
              />
              <div className="bg-primary-50/60 border border-primary-100 rounded-xl p-3">
                <label className="text-xs text-primary-900 font-semibold mb-1 block">
                  Precio por unidad (opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    value={editItemForm.unitPrice}
                    onChange={(e) =>
                      setEditItemForm((p) => ({
                        ...p,
                        unitPrice: e.target.value,
                      }))
                    }
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-primary-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-primary-800/70 mt-1.5">
                  {parseNum(editItemForm.unitPrice) > 0
                    ? `Total del material: ${formatCurrency(parseNum(editItemForm.unitPrice) * parseNum(editItemForm.quantityOrdered))}`
                    : "Sin precio: no descuenta del presupuesto"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Cantidad pedida
                  </label>
                  <input
                    type="number"
                    value={editItemForm.quantityOrdered}
                    onChange={(e) =>
                      setEditItemForm((p) => ({
                        ...p,
                        quantityOrdered: e.target.value,
                      }))
                    }
                    min="0"
                    step="any"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    Cantidad recibida
                  </label>
                  <input
                    type="number"
                    value={editItemForm.quantityReceived}
                    onChange={(e) =>
                      setEditItemForm((p) => ({
                        ...p,
                        quantityReceived: e.target.value,
                      }))
                    }
                    min="0"
                    step="any"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-green-200 bg-green-50/50 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Unidad
                </label>
                <select
                  value={editItemForm.unit}
                  onChange={(e) =>
                    setEditItemForm((p) => ({ ...p, unit: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={editItemForm.notes}
                onChange={(e) =>
                  setEditItemForm((p) => ({ ...p, notes: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Nota (opcional)"
              />
              {itemError && <p className="text-red-500 text-xs">{itemError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemError("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEditItem}
                  disabled={
                    itemLoading ||
                    !editItemForm.name ||
                    !editItemForm.quantityOrdered
                  }
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {itemLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingObra && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-4">Editar obra</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={obraForm.name}
                onChange={(e) =>
                  setObraForm((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Nombre"
              />
              <textarea
                value={obraForm.description}
                onChange={(e) =>
                  setObraForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                placeholder="Descripción"
              />
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Presupuesto total
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    value={obraForm.budget}
                    onChange={(e) =>
                      setObraForm((p) => ({ ...p, budget: e.target.value }))
                    }
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="Presupuesto"
                  />
                </div>
              </div>

              {cobros.length === 0 ? (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                  <label className="text-xs text-emerald-800 font-semibold mb-1 block">
                    Adelanto cobrado
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={obraForm.advanceAmount}
                      onChange={(e) =>
                        setObraForm((p) => ({
                          ...p,
                          advanceAmount: e.target.value,
                        }))
                      }
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[30, 50, 70, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setObraForm((p) => ({
                            ...p,
                            advanceAmount: (
                              (parseNum(p.budget) * pct) /
                              100
                            ).toFixed(2),
                          }))
                        }
                        className="flex-1 py-1.5 rounded-lg border border-emerald-200 bg-white text-xs text-emerald-700 font-semibold hover:bg-emerald-100 transition"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-emerald-700/80 mt-2 leading-relaxed">
                    Los jornales, materiales y gastos se descuentan de esta plata.
                    Falta cobrar:{" "}
                    <span className="font-semibold">
                      {formatCurrency(
                        Math.max(
                          0,
                          parseNum(obraForm.budget) -
                            parseNum(obraForm.advanceAmount),
                        ),
                      )}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                  <p className="text-xs text-emerald-800 font-semibold">
                    Cobrado: {formatCurrency(cobrado)}
                  </p>
                  <p className="text-xs text-emerald-700/80 mt-1 leading-relaxed">
                    Sale de la suma de {cobros.length} cobro
                    {cobros.length !== 1 ? "s" : ""} cargado
                    {cobros.length !== 1 ? "s" : ""}. Para cambiarlo, editá la
                    lista en la pestaña Cobros.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingObra(false);
                      setTab("cobros");
                    }}
                    className="mt-2 w-full py-1.5 rounded-lg border border-emerald-200 bg-white text-xs text-emerald-700 font-semibold hover:bg-emerald-100 transition"
                  >
                    Ver cobros
                  </button>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingObra(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveObra}
                  disabled={obraLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {obraLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-4">Editar empleado</h3>
            <EmpForm
              form={editEmpForm}
              setForm={setEditEmpForm}
              onSave={saveEditEmployee}
              onCancel={() => setEditingEmp(null)}
              loading={empLoading}
              error=""
            />
          </div>
        </div>
      )}

      {showFinalizar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="text-3xl text-center mb-3">🏁</div>
            <h3 className="font-bold text-slate-800 mb-2 text-center">
              ¿Finalizar esta obra?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              La obra quedará marcada como finalizada. Se guardará el balance
              completo con empleados y gastos extras.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFinalizar(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={finalizarObra}
                disabled={finalizando}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {finalizando ? "Finalizando..." : "Sí, finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BUDGET CARD ────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-4 mb-4 text-white shadow-md">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-primary-300 text-xs font-medium uppercase tracking-wide">
              {cobrado > 0 ? "Plata disponible" : "Presupuesto restante"}
            </p>
            <p
              className={`text-3xl font-bold mt-0.5 ${(cobrado > 0 ? disponible : project.budgetRemaining) < 0 ? "text-red-300" : ""}`}
            >
              {formatCurrency(cobrado > 0 ? disponible : project.budgetRemaining)}
            </p>
            {cobrado > 0 && (
              <button
                onClick={() => setTab("cobros")}
                className="text-primary-300 text-xs mt-0.5 underline decoration-primary-500 underline-offset-2 hover:text-white transition"
              >
                de {formatCurrency(cobrado)} cobrados
                {cobros.length > 0
                  ? ` en ${cobros.length} pago${cobros.length !== 1 ? "s" : ""}`
                  : ""}
              </button>
            )}
          </div>
          <div className="text-right">
            <p className="text-primary-300 text-xs">Presupuesto total</p>
            <p className="text-primary-100 font-semibold text-sm">
              {formatCurrency(project.budget)}
            </p>
            {cobrado > 0 && (
              <p className="text-amber-300 text-xs mt-1 font-medium">
                Falta cobrar {formatCurrency(faltaCobrar)}
              </p>
            )}
          </div>
        </div>

        <div className="h-2 bg-primary-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barPct > 85 ? "bg-red-400" : barPct > 60 ? "bg-amber-400" : "bg-emerald-400"}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-primary-300 mt-1">
          <span>Gastado: {formatCurrency(gastado)}</span>
          <span>
            {cobrado > 0
              ? `${Math.round(consumoPct)}% del adelanto`
              : `${Math.round(consumoPct)}% del presupuesto`}
          </span>
        </div>

        {cobrado > 0 && disponible < 0 && (
          <div className="mt-2.5 bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2">
            <p className="text-red-200 text-xs font-semibold">
              Estás poniendo {formatCurrency(Math.abs(disponible))} de tu bolsillo
            </p>
            <p className="text-red-200/80 text-xs">
              Lo recuperás cuando cobres el resto ({formatCurrency(faltaCobrar)}).
            </p>
          </div>
        )}

        {project.budgetRemaining < 0 && (
          <div className="mt-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl px-3 py-2">
            <p className="text-amber-100 text-xs font-semibold">
              Te pasaste del presupuesto en{" "}
              {formatCurrency(Math.abs(project.budgetRemaining))}
            </p>
            <p className="text-amber-100/80 text-xs">
              La obra ya cuesta más de lo que cotizaste. Podés seguir cargando
              igual.
            </p>
          </div>
        )}

        {cobrado === 0 && !isFinished && (
          <button
            onClick={() => {
              setTab("cobros");
              setShowCobroForm(true);
              setCobroError("");
            }}
            className="mt-2.5 w-full text-left bg-white/10 hover:bg-white/15 transition rounded-xl px-3 py-2"
          >
            <p className="text-xs font-semibold text-white">
              ¿Te adelantaron plata? Registrá el cobro
            </p>
            <p className="text-xs text-primary-300">
              La app descuenta de esa plata, no del total del presupuesto.
            </p>
          </button>
        )}

        <div className="mt-2.5 pt-2.5 border-t border-primary-700 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-primary-300 text-[11px]">Personal</p>
            <p className="text-primary-100 text-xs font-semibold">
              {formatCurrency(totalPersonal)}
            </p>
          </div>
          <div>
            <p className="text-primary-300 text-[11px]">Materiales</p>
            <p className="text-primary-100 text-xs font-semibold">
              {formatCurrency(totalMateriales)}
            </p>
          </div>
          <div>
            <p className="text-primary-300 text-[11px]">Gastos extras</p>
            <p className="text-primary-100 text-xs font-semibold">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
        </div>

        {cobrado > 0 && (
          <div className="mt-2 pt-2 border-t border-primary-700 flex justify-between text-xs text-primary-300">
            <span
              className={project.budgetRemaining < 0 ? "text-red-300" : ""}
            >
              Saldo del presupuesto: {formatCurrency(project.budgetRemaining)}
            </span>
            <span>{budgetPct.toFixed(0)}% restante</span>
          </div>
        )}
      </div>

      {/* ─── BALANCE FINAL (when finished) ──────────────────── */}
      {isFinished && (
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-2xl p-4 mb-4 text-white shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-emerald-300 text-xs font-medium uppercase tracking-wide">
                🏁 Obra finalizada
              </p>
              <p className="text-sm font-semibold text-white mt-0.5">
                Balance registrado
              </p>
            </div>
            <button
              onClick={() => generarPDFBalance(project as any)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-xl transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              PDF Balance
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-emerald-300 text-xs">Personal</p>
              <p className="text-white font-bold text-sm">
                {formatCurrency(totalPersonal)}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-emerald-300 text-xs">Materiales</p>
              <p className="text-white font-bold text-sm">
                {formatCurrency(totalMateriales)}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-emerald-300 text-xs">Gastos extras</p>
              <p className="text-white font-bold text-sm">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-emerald-300 text-xs">Saldo final</p>
              <p className="text-white font-bold text-sm">
                {formatCurrency(project.budgetRemaining)}
              </p>
            </div>
          </div>
          {cobrado > 0 && (
            <div className="mt-2 flex justify-between text-xs text-emerald-200">
              <span>Cobrado: {formatCurrency(cobrado)}</span>
              <span>Falta cobrar: {formatCurrency(faltaCobrar)}</span>
            </div>
          )}
        </div>
      )}

      {/* ─── TABS ───────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4 overflow-x-auto">
        {(
          [
            ["asistencia", "Asistencia"],
            ["empleados", "Empleados"],
            ["materiales", "Materiales"],
            ["gastos", "Gastos"],
            ["cobros", "Cobros"],
            ["historial", "Historial"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs sm:text-sm py-2 px-2 rounded-lg font-medium transition whitespace-nowrap ${tab === t ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {label}
            {t === "gastos" && (project.expenses ?? []).length > 0 && (
              <span className="ml-1 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {(project.expenses ?? []).length}
              </span>
            )}
            {t === "materiales" && matPendientes > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {matPendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB: ASISTENCIA ────────────────────────────────── */}
      {tab === "asistencia" && (
        <div>
          {isFinished ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">🏁</div>
              <p className="text-slate-500 text-sm">
                Esta obra está finalizada. Revisá el historial de semanas.
              </p>
            </div>
          ) : !currentPayroll ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-semibold text-slate-700 mb-1">
                No hay semana abierta
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Abrí una nueva semana para registrar asistencias
              </p>
              <button
                onClick={openWeek}
                disabled={project.employees.length === 0}
                className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
              >
                Abrir semana actual
              </button>
              {project.employees.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Primero agregá empleados en "Empleados"
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Semana actual
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(currentPayroll.weekStart)} –{" "}
                    {formatDate(currentPayroll.weekEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total a pagar</p>
                  <p className="text-lg font-bold text-obra-600">
                    {formatCurrency(weekTotal)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">
                          Empleado
                        </th>
                        {DAYS_OF_WEEK.map((d) => (
                          <th
                            key={d.key}
                            className="text-center px-2 py-2.5 text-xs font-semibold text-slate-500 min-w-[44px]"
                          >
                            {d.label}
                          </th>
                        ))}
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.employees.map((emp, i) => (
                        <tr
                          key={emp.id}
                          className={`border-b border-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 text-sm">
                              {emp.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {emp.paymentType === "sqm"
                                ? `$${emp.sqmRate}/m²`
                                : `${formatCurrency(emp.dailyRate)}/día`}
                            </div>
                          </td>
                          {DAYS_OF_WEEK.map((d) => {
                            const att = attendances[emp.id]?.[d.key];
                            const present = att?.present ?? false;
                            return (
                              <td key={d.key} className="text-center px-1 py-2">
                                <button
                                  onClick={() =>
                                    toggleAttendance(emp.id, d.key)
                                  }
                                  className={`w-8 h-8 rounded-lg font-bold text-sm transition ${present ? "bg-emerald-100 text-emerald-600 border-2 border-emerald-300" : "bg-slate-100 text-slate-300 border-2 border-slate-200 hover:border-slate-300"}`}
                                >
                                  {present ? "✓" : "–"}
                                </button>
                                {emp.paymentType === "sqm" && present && (
                                  <input
                                    type="number"
                                    value={att?.meters ?? ""}
                                    min="0"
                                    step="0.1"
                                    onChange={(e) =>
                                      updateMeters(
                                        emp.id,
                                        d.key,
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-12 mt-1 text-xs text-center border border-slate-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                    placeholder="m²"
                                  />
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-3 py-3">
                            <div className="font-bold text-slate-800 text-sm">
                              {formatCurrency(calcEmpWeekTotal(emp))}
                            </div>
                            {emp.paymentType === "sqm" && (
                              <div className="text-xs text-slate-400">
                                {Object.values(attendances[emp.id] ?? {})
                                  .reduce(
                                    (s, a) =>
                                      s + (a.present ? (a.meters ?? 0) : 0),
                                    0,
                                  )
                                  .toFixed(1)}
                                m²
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {cobrError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-3">
                  {cobrError}
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Cerrar semana
                    </p>
                    <p className="text-xs text-slate-400">
                      {weekTotal > 0
                        ? `Se descontará ${formatCurrency(weekTotal)} del presupuesto`
                        : "Semana sin días trabajados — se cerrará sin costo"}
                    </p>
                  </div>
                  <span className="text-xl font-bold text-obra-600">
                    {formatCurrency(weekTotal)}
                  </span>
                </div>
                <button
                  onClick={cobrarSemana}
                  disabled={cobrandoSemana}
                  className="w-full bg-obra-500 hover:bg-obra-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-base flex items-center justify-center gap-2"
                >
                  {cobrandoSemana ? (
                    <>
                      <span className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" />
                      Procesando...
                    </>
                  ) : weekTotal > 0 ? (
                    <>💰 Cobrar semana — {formatCurrency(weekTotal)}</>
                  ) : (
                    <>📅 Cerrar semana libre</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: EMPLEADOS ─────────────────────────────────── */}
      {tab === "empleados" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-600">
              {project.employees.length} empleado
              {project.employees.length !== 1 ? "s" : ""}
            </p>
            {!isFinished && (
              <button
                onClick={() => {
                  setShowEmpForm(true);
                  setEmpError("");
                }}
                className="flex items-center gap-1 text-sm text-primary-700 font-semibold"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Agregar
              </button>
            )}
          </div>

          {showEmpForm && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-primary-100 mb-3">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">
                Nuevo empleado
              </h4>
              <EmpForm
                form={empForm}
                setForm={setEmpForm}
                onSave={addEmployee}
                onCancel={() => {
                  setShowEmpForm(false);
                  setEmpForm({
                    name: "",
                    paymentType: "daily",
                    dailyRate: "",
                    sqmRate: "",
                  });
                }}
                loading={empLoading}
                error={empError}
              />
            </div>
          )}

          {project.employees.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">👷</div>
              <p className="text-slate-500 text-sm">No hay empleados todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {project.employees.map((emp) => (
                <div
                  key={emp.id}
                  className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">
                        {emp.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {emp.paymentType === "sqm"
                          ? `📐 $${emp.sqmRate}/m²`
                          : `💵 ${formatCurrency(emp.dailyRate)}/día`}
                      </p>
                    </div>
                  </div>
                  {!isFinished && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingEmp(emp);
                          setEditEmpForm({
                            name: emp.name,
                            paymentType: emp.paymentType,
                            dailyRate: emp.dailyRate?.toString() ?? "",
                            sqmRate: emp.sqmRate?.toString() ?? "",
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteEmployee(emp.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isFinished && (
            <button
              onClick={() => setShowFinalizar(true)}
              className="w-full mt-4 border border-dashed border-red-200 hover:border-red-300 text-red-500 bg-red-50/30 font-medium py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5"
            >
              🏁 Finalizar obra
            </button>
          )}
        </div>
      )}

      {/* ─── TAB: MATERIALES ────────────────────────────────── */}
      {tab === "materiales" && (
        <div>
          {/* Encabezado + acciones */}
          <div className="flex items-start justify-between mb-3 gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {orders.length} pedido{orders.length !== 1 ? "s" : ""}
              </p>
              {allMatItems.length > 0 && (
                <p className="text-xs text-slate-400">
                  <span className="text-green-600 font-medium">
                    {matCompletos} recibido{matCompletos !== 1 ? "s" : ""}
                  </span>
                  {" · "}
                  <span className="text-amber-600 font-medium">
                    {matPendientes} pendiente{matPendientes !== 1 ? "s" : ""}
                  </span>
                </p>
              )}
              {totalMateriales > 0 && (
                <p className="text-xs text-primary-700 font-semibold mt-0.5">
                  {formatCurrency(totalMateriales)} en materiales
                </p>
              )}
            </div>
            {!isFinished && (
              <button
                onClick={() => {
                  setShowPedidoForm(true);
                  setPedidoError("");
                }}
                className="flex items-center gap-1 text-sm text-primary-700 font-semibold shrink-0"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Nuevo pedido
              </button>
            )}
          </div>

          {/* Barra de PDF */}
          {allMatItems.length > 0 && (
            <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 mb-3 flex items-center gap-2">
              <select
                value={pdfFiltro}
                onChange={(e) => setPdfFiltro(e.target.value as any)}
                className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="todos">Pedido vs recibido (completo)</option>
                <option value="recibidos">Solo materiales recibidos</option>
                <option value="pendientes">Solo lo que falta</option>
              </select>
              <button
                onClick={() =>
                  generarPDFMateriales(project, orders, pdfFiltro)
                }
                className="flex items-center gap-1 text-xs text-white bg-primary-600 hover:bg-primary-700 font-semibold px-3 py-2 rounded-lg transition shrink-0"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                PDF
              </button>
            </div>
          )}

          {/* Form nuevo pedido */}
          {showPedidoForm && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-primary-100 mb-3">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">
                Nuevo pedido de materiales
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={pedidoForm.name}
                  onChange={(e) =>
                    setPedidoForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                  placeholder="Nombre del pedido (ej: Pedido 1 - Placas y perfiles)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={pedidoForm.supplier}
                    onChange={(e) =>
                      setPedidoForm((p) => ({ ...p, supplier: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="Proveedor (opcional)"
                  />
                  <input
                    type="date"
                    value={pedidoForm.orderDate}
                    onChange={(e) =>
                      setPedidoForm((p) => ({
                        ...p,
                        orderDate: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                  />
                </div>
                {pedidoError && (
                  <p className="text-red-500 text-xs">{pedidoError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowPedidoForm(false);
                      setPedidoError("");
                    }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addPedido}
                    disabled={pedidoLoading || !pedidoForm.name}
                    className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {pedidoLoading ? "Creando..." : "Crear pedido"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de pedidos */}
          {orders.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-slate-500 text-sm">
                No hay pedidos de materiales
              </p>
              {!isFinished && (
                <p className="text-xs text-slate-400 mt-1">
                  Creá un pedido y cargá los items que encargaste
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const abierto = openOrders[order.id] ?? true;
                const completos = order.items.filter(
                  (i) => itemEstado(i) === "completo",
                ).length;
                const total = order.items.length;
                const pct = total > 0 ? (completos / total) * 100 : 0;
                const costoPedido = order.items.reduce(
                  (s, i) => s + (i.unitPrice ?? 0) * i.quantityOrdered,
                  0,
                );
                const estadoColor =
                  total === 0
                    ? "bg-slate-100 text-slate-500"
                    : completos === total
                      ? "bg-green-100 text-green-700"
                      : completos > 0 ||
                          order.items.some((i) => i.quantityReceived > 0)
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500";
                const estadoLabel =
                  total === 0
                    ? "Sin items"
                    : completos === total
                      ? "Completo"
                      : completos > 0 ||
                          order.items.some((i) => i.quantityReceived > 0)
                        ? "Parcial"
                        : "Pendiente";

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                  >
                    {/* Cabecera del pedido */}
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() =>
                            setOpenOrders((p) => ({
                              ...p,
                              [order.id]: !abierto,
                            }))
                          }
                          className="flex items-start gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <svg
                            className={`w-4 h-4 mt-0.5 text-slate-400 shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">
                              {order.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {formatDate(order.orderDate)}
                              {order.supplier ? ` · ${order.supplier}` : ""}
                            </p>
                            {costoPedido > 0 && (
                              <p className="text-xs text-primary-700 font-semibold">
                                {formatCurrency(costoPedido)}
                              </p>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${estadoColor}`}
                          >
                            {estadoLabel}
                          </span>
                          {!isFinished && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPedido(order);
                                  setEditPedidoForm({
                                    name: order.name,
                                    supplier: order.supplier ?? "",
                                    orderDate: new Date(order.orderDate)
                                      .toISOString()
                                      .split("T")[0],
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => deletePedido(order.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      {total > 0 && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${completos === total ? "bg-green-500" : "bg-amber-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-medium shrink-0">
                            {completos}/{total}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    {abierto && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {order.items.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">
                            Sin materiales cargados
                          </p>
                        )}
                        {order.items.map((item) => {
                          const estado = itemEstado(item);
                          const falta = Math.max(
                            0,
                            item.quantityOrdered - item.quantityReceived,
                          );
                          return (
                            <div
                              key={item.id}
                              className={`px-3.5 py-3 ${estado === "completo" ? "bg-green-50/40" : estado === "parcial" ? "bg-amber-50/40" : ""}`}
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Checkbox */}
                                <button
                                  onClick={() =>
                                    !isFinished && toggleItemRecibido(item)
                                  }
                                  disabled={isFinished}
                                  className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                                    estado === "completo"
                                      ? "bg-green-500 border-green-500"
                                      : estado === "parcial"
                                        ? "bg-amber-400 border-amber-400"
                                        : "border-slate-300 hover:border-primary-400"
                                  } ${isFinished ? "opacity-60" : ""}`}
                                >
                                  {estado === "completo" && (
                                    <svg
                                      className="w-3 h-3 text-white"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3.5}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
                                  {estado === "parcial" && (
                                    <div className="w-2 h-0.5 bg-white rounded-full" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm font-medium truncate ${estado === "completo" ? "text-slate-500 line-through" : "text-slate-800"}`}
                                  >
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Pedido: {item.quantityOrdered} {item.unit}
                                    {item.quantityReceived > 0 && (
                                      <>
                                        {" · "}
                                        <span className="text-green-600 font-medium">
                                          Llegó: {item.quantityReceived}{" "}
                                          {item.unit}
                                        </span>
                                      </>
                                    )}
                                    {falta > 0 && item.quantityReceived > 0 && (
                                      <>
                                        {" · "}
                                        <span className="text-red-500 font-semibold">
                                          Falta: {falta} {item.unit}
                                        </span>
                                      </>
                                    )}
                                  </p>
                                  {(item.unitPrice ?? 0) > 0 ? (
                                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                                      {formatCurrency(item.unitPrice)} c/u ·{" "}
                                      <span className="text-primary-700 font-semibold">
                                        {formatCurrency(
                                          item.unitPrice * item.quantityOrdered,
                                        )}
                                      </span>
                                    </p>
                                  ) : (
                                    !isFinished && (
                                      <button
                                        onClick={() => abrirEditItem(item)}
                                        className="text-xs text-primary-700 font-semibold mt-0.5 underline decoration-primary-300 underline-offset-2"
                                      >
                                        + Poner precio
                                      </button>
                                    )
                                  )}
                                  {item.notes && (
                                    <p className="text-xs text-slate-400 italic mt-0.5">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>

                                {!isFinished && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => abrirEditItem(item)}
                                      className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                                    >
                                      <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                        />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteItem(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 transition"
                                    >
                                      <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Cantidad recibida rápida */}
                              {!isFinished && estado !== "completo" && (
                                <div className="flex items-center gap-2 mt-2 ml-7.5 pl-0.5">
                                  <span className="text-xs text-slate-400">
                                    Llegó:
                                  </span>
                                  <input
                                    type="number"
                                    defaultValue={item.quantityReceived || ""}
                                    min="0"
                                    step="any"
                                    onBlur={(e) => {
                                      const v = parseFloat(e.target.value);
                                      const nuevo = isNaN(v) ? 0 : v;
                                      if (nuevo !== item.quantityReceived)
                                        setCantidadRecibida(item, nuevo);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        (e.target as HTMLInputElement).blur();
                                    }}
                                    className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="0"
                                  />
                                  <span className="text-xs text-slate-400">
                                    de {item.quantityOrdered} {item.unit}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Agregar item */}
                        {!isFinished && (
                          <div className="p-3.5 bg-slate-50/60">
                            {addItemFor === order.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={itemForm.name}
                                  onChange={(e) =>
                                    setItemForm((p) => ({
                                      ...p,
                                      name: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                                  placeholder="Material (ej: Tornillos T1 punta aguja)"
                                  autoFocus
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="number"
                                    value={itemForm.quantityOrdered}
                                    onChange={(e) =>
                                      setItemForm((p) => ({
                                        ...p,
                                        quantityOrdered: e.target.value,
                                      }))
                                    }
                                    min="0"
                                    step="any"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                                    placeholder="Cantidad"
                                  />
                                  <select
                                    value={itemForm.unit}
                                    onChange={(e) =>
                                      setItemForm((p) => ({
                                        ...p,
                                        unit: e.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                                  >
                                    {UNIDADES.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2 items-center">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      value={itemForm.unitPrice}
                                      onChange={(e) =>
                                        setItemForm((p) => ({
                                          ...p,
                                          unitPrice: e.target.value,
                                        }))
                                      }
                                      min="0"
                                      step="0.01"
                                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                                      placeholder="Precio c/u"
                                    />
                                  </div>
                                  <p className="text-xs text-right pr-1">
                                    {parseNum(itemForm.unitPrice) > 0 ? (
                                      <span className="text-slate-700 font-semibold">
                                        {formatCurrency(
                                          parseNum(itemForm.unitPrice) *
                                            parseNum(itemForm.quantityOrdered),
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">
                                        Sin precio
                                      </span>
                                    )}
                                  </p>
                                </div>
                                {itemError && (
                                  <p className="text-red-500 text-xs">
                                    {itemError}
                                  </p>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setAddItemFor(null);
                                      setItemError("");
                                      setItemForm({
                                        name: "",
                                        quantityOrdered: "",
                                        unit: "un",
                                        unitPrice: "",
                                        notes: "",
                                      });
                                    }}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs"
                                  >
                                    Listo
                                  </button>
                                  <button
                                    onClick={() => addItem(order.id)}
                                    disabled={
                                      itemLoading ||
                                      !itemForm.name ||
                                      !itemForm.quantityOrdered
                                    }
                                    className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
                                  >
                                    {itemLoading
                                      ? "Agregando..."
                                      : "Agregar material"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAddItemFor(order.id);
                                  setItemError("");
                                }}
                                className="flex items-center gap-1.5 text-xs text-primary-700 font-semibold"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                                Agregar material
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: COBROS ────────────────────────────────────── */}
      {tab === "cobros" && (
        <div>
          {/* Resumen de cobranza */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-400">Cobrado</p>
                <p className="text-sm font-bold text-emerald-600">
                  {formatCurrency(cobrado)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Falta cobrar</p>
                <p className="text-sm font-bold text-amber-600">
                  {formatCurrency(faltaCobrar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Disponible</p>
                <p
                  className={`text-sm font-bold ${disponible < 0 ? "text-red-500" : "text-slate-800"}`}
                >
                  {formatCurrency(disponible)}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, project.budget > 0 ? (cobrado / project.budget) * 100 : 0))}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 text-center">
              {formatCurrency(cobrado)} de {formatCurrency(project.budget)} del
              presupuesto
            </p>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-600">
              {cobros.length} cobro{cobros.length !== 1 ? "s" : ""} registrado
              {cobros.length !== 1 ? "s" : ""}
            </p>
            {!isFinished && !showCobroForm && (
              <button
                onClick={() => {
                  setShowCobroForm(true);
                  setCobroError("");
                }}
                className="flex items-center gap-1 text-sm text-emerald-700 font-semibold"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Registrar cobro
              </button>
            )}
          </div>

          {/* Form nuevo cobro */}
          {showCobroForm && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 mb-3">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">
                Nuevo cobro
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">
                      Monto
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={cobroForm.amount}
                        onChange={(e) =>
                          setCobroForm((p) => ({ ...p, amount: e.target.value }))
                        }
                        min="0"
                        step="0.01"
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={cobroForm.date}
                      onChange={(e) =>
                        setCobroForm((p) => ({ ...p, date: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {[30, 50, 70].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() =>
                        setCobroForm((p) => ({
                          ...p,
                          amount: ((project.budget * pct) / 100).toFixed(2),
                        }))
                      }
                      className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-semibold hover:bg-slate-50 transition"
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={faltaCobrar <= 0}
                    onClick={() =>
                      setCobroForm((p) => ({
                        ...p,
                        amount: faltaCobrar.toFixed(2),
                      }))
                    }
                    className="flex-1 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-700 font-semibold hover:bg-emerald-100 transition disabled:opacity-40"
                  >
                    Saldo
                  </button>
                </div>

                <input
                  type="text"
                  value={cobroForm.note}
                  onChange={(e) =>
                    setCobroForm((p) => ({ ...p, note: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  placeholder="Nota (ej: seña, transferencia, efectivo)"
                />

                {cobroError && (
                  <p className="text-red-500 text-xs">{cobroError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCobroForm(false);
                      setCobroError("");
                    }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addCobro}
                    disabled={cobroLoading || !cobroForm.amount}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {cobroLoading ? "Guardando..." : "Registrar cobro"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de cobros */}
          {cobros.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">💵</div>
              <p className="text-slate-500 text-sm">Todavía no cargaste cobros</p>
              <p className="text-xs text-slate-400 mt-1">
                Registrá cada plata que te entrega el cliente y la app descuenta
                los gastos de ahí.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cobros.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-700">
                      {formatCurrency(c.amount)}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {formatDate(c.date)}
                      {c.note ? ` · ${c.note}` : ""}
                    </p>
                  </div>
                  {!isFinished && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingCobro(c);
                          setCobroError("");
                          setEditCobroForm({
                            amount: String(c.amount),
                            date: new Date(c.date).toISOString().split("T")[0],
                            note: c.note ?? "",
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteCobro(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: GASTOS EXTRAS ─────────────────────────────── */}
      {tab === "gastos" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {(project.expenses ?? []).length} gasto
                {(project.expenses ?? []).length !== 1 ? "s" : ""} extra
                {(project.expenses ?? []).length !== 1 ? "s" : ""}
              </p>
              {totalExpenses > 0 && (
                <p className="text-xs text-red-500 font-medium">
                  {formatCurrency(totalExpenses)} total
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(project.expenses ?? []).length > 0 && (
                <button
                  onClick={() =>
                    generarPDFGastos(project, project.expenses ?? [])
                  }
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium border border-slate-200 px-2.5 py-1.5 rounded-lg transition"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  PDF
                </button>
              )}
              {!isFinished && (
                <button
                  onClick={() => {
                    setShowGastoForm(true);
                    setGastoError("");
                  }}
                  className="flex items-center gap-1 text-sm text-primary-700 font-semibold"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Agregar
                </button>
              )}
            </div>
          </div>

          {showGastoForm && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100 mb-3">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">
                Nuevo gasto extra
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={gastoForm.description}
                  onChange={(e) =>
                    setGastoForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  placeholder="Descripción del gasto (ej: materiales, herramientas...)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={gastoForm.amount}
                      onChange={(e) =>
                        setGastoForm((p) => ({ ...p, amount: e.target.value }))
                      }
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                      placeholder="Monto (USD)"
                    />
                  </div>
                  <input
                    type="date"
                    value={gastoForm.date}
                    onChange={(e) =>
                      setGastoForm((p) => ({ ...p, date: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  />
                </div>
                {gastoError && (
                  <p className="text-red-500 text-xs">{gastoError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowGastoForm(false);
                      setGastoError("");
                      setGastoForm({
                        description: "",
                        amount: "",
                        date: new Date().toISOString().split("T")[0],
                      });
                    }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addGasto}
                    disabled={
                      gastoLoading ||
                      !gastoForm.description ||
                      !gastoForm.amount
                    }
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {gastoLoading ? "Guardando..." : "Guardar gasto"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(project.expenses ?? []).length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🧾</div>
              <p className="text-slate-500 text-sm">
                No hay gastos extras registrados
              </p>
              {!isFinished && (
                <p className="text-xs text-slate-400 mt-1">
                  Registrá materiales, herramientas u otros costos
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {(project.expenses ?? []).map((expense) => (
                <div
                  key={expense.id}
                  className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                      🧾
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">
                        {expense.description}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(expense.date).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-red-600 text-sm">
                      {formatCurrency(expense.amount)}
                    </span>
                    {!isFinished && (
                      <button
                        onClick={() => abrirEditarGasto(expense)}
                        aria-label={`Editar ${expense.description}`}
                        className="p-2 text-slate-500 hover:text-primary-600 active:bg-slate-100 rounded-lg transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    )}
                    {!isFinished && (
                      <button
                        onClick={() => deleteGasto(expense.id)}
                        aria-label={`Eliminar ${expense.description}`}
                        className="p-2 text-slate-500 hover:text-red-500 active:bg-slate-100 rounded-lg transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Totals row */}
              <div className="bg-red-50 rounded-xl p-3.5 border border-red-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-red-700">
                  Total gastos extras
                </span>
                <span className="text-lg font-bold text-red-700">
                  {formatCurrency(totalExpenses)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: HISTORIAL ─────────────────────────────────── */}
      {tab === "historial" && (
        <div className="space-y-2">
          {(() => {
            const closedPayrolls = project.payrolls.filter(
              (p) => p.status === "closed",
            );

            if (closedPayrolls.length === 0) {
              return (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">📂</div>
                  <p className="text-slate-500 text-sm">
                    No hay semanas pagadas
                  </p>
                </div>
              );
            }

            return closedPayrolls.map((p) => (
              <HistorialCard
                key={p.id}
                payroll={p}
                project={project}
                isFinished={isFinished}
                onReabrir={() => reabrirSemana(p.id)}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
}

// ─── HISTORIAL CARD ──────────────────────────────────────────────────────────

function HistorialCard({
  payroll,
  project,
  isFinished,
  onReabrir,
}: {
  payroll: Payroll & { payments?: Payment[] };
  project: ProjectDetail;
  isFinished: boolean;
  onReabrir: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const payments = payroll.payments ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Fila principal */}
      <div className="p-3.5 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-700 text-sm">
            Semana {formatDate(payroll.weekStart)}
          </p>
          <p className="text-xs text-slate-400">
            Hasta el {formatDate(payroll.weekEnd)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-sm">
            {payroll.totalPaid > 0 ? (
              formatCurrency(payroll.totalPaid)
            ) : (
              <span className="text-slate-400 font-medium text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                Semana libre
              </span>
            )}
          </span>

          {/* Ver detalle por empleado */}
          {payments.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-500 transition"
              title={expanded ? "Ocultar detalle" : "Ver cobro por empleado"}
            >
              <svg
                className="w-4 h-4 transition-transform"
                style={{
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}

          {/* Descargar PDF */}
          <button
            onClick={() =>
              generarPDF(project, payroll, payroll.attendances || [])
            }
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 transition"
            title="Descargar PDF"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>

          {/* Reabrir semana */}
          {!isFinished && (
            <button
              onClick={() => {
                if (
                  confirm(
                    "¿Reabrir esta semana?\n\nSe borrará el cobro registrado y se restaurará el presupuesto. Podrás editar las asistencias y volver a cobrar.",
                  )
                )
                  onReabrir();
              }}
              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 transition"
              title="Reabrir semana para editar"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Detalle expandido — cobro por empleado */}
      {expanded && payments.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3.5 pb-3.5 pt-2.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Cobro por empleado
          </p>
          <div className="space-y-2">
            {payments.map((pay) => (
              <div
                key={pay.id}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                    {pay.employee?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {pay.employee?.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {pay.employee?.paymentType === "sqm"
                        ? `${pay.metersTotal.toFixed(1)} m²`
                        : `${pay.daysWorked} día${pay.daysWorked !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-slate-800 text-sm">
                  {formatCurrency(pay.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMP FORM ────────────────────────────────────────────────────────────────

const EmpForm = ({
  form,
  setForm,
  onSave,
  onCancel,
  loading,
  error,
}: EmpFormProps) => (
  <div className="space-y-3">
    <input
      type="text"
      value={form.name}
      onChange={(e) => setForm({ ...form, name: e.target.value })}
      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
      placeholder="Nombre del empleado"
    />
    <div className="flex gap-2">
      <button
        onClick={() => setForm({ ...form, paymentType: "daily" })}
        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${form.paymentType === "daily" ? "bg-primary-700 text-white border-primary-700" : "border-slate-200 text-slate-600"}`}
      >
        💵 Por día
      </button>
      <button
        onClick={() => setForm({ ...form, paymentType: "sqm" })}
        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${form.paymentType === "sqm" ? "bg-primary-700 text-white border-primary-700" : "border-slate-200 text-slate-600"}`}
      >
        📐 Por m²
      </button>
    </div>
    {form.paymentType === "daily" ? (
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          $
        </span>
        <input
          type="number"
          value={form.dailyRate}
          onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
          min="0"
          step="0.01"
          className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          placeholder="Jornal diario (USD)"
        />
      </div>
    ) : (
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          $
        </span>
        <input
          type="number"
          value={form.sqmRate}
          onChange={(e) => setForm({ ...form, sqmRate: e.target.value })}
          min="0"
          step="0.01"
          className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          placeholder="Precio por m² (USD)"
        />
      </div>
    )}
    {error && <p className="text-red-500 text-xs">{error}</p>}
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm"
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={loading}
        className="flex-1 py-2 rounded-xl bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </div>
  </div>
);
