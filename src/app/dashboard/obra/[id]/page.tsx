"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, DAYS_OF_WEEK } from "@/lib/utils";
import type { Project, Employee, Payroll, Attendance } from "@/types";
import { generarPDF } from "@/components/pdf/generarPDF";

type Tab = "asistencia" | "empleados" | "historial";
interface ProjectDetail extends Project {
  employees: Employee[];
  payrolls: Payroll[];
}

// Interfaz para las props del formulario que ahora está afuera
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
  });
  const [obraLoading, setObraLoading] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

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

  async function finalizarObra() {
    if (!project) return;
    setFinalizando(true);
    await fetch(`/api/obras/${project.id}/finalizar`, { method: "POST" });
    setFinalizando(false);
    setShowFinalizar(false);
    router.push("/dashboard");
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
        budget: parseFloat(obraForm.budget),
      }),
    });
    setObraLoading(false);
    setEditingObra(false);
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

      {/* Modals */}
      {editingObra && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
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
                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Presupuesto"
                />
              </div>
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
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
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
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="text-3xl text-center mb-3">🏁</div>
            <h3 className="font-bold text-slate-800 mb-2 text-center">
              ¿Finalizar esta obra?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              La obra quedará marcada como finalizada. El historial y los datos
              se conservan para siempre.
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

      {/* Budget card */}
      <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-4 mb-4 text-white shadow-md">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-primary-300 text-xs font-medium uppercase tracking-wide">
              Presupuesto restante
            </p>
            <p className="text-3xl font-bold mt-0.5">
              {formatCurrency(project.budgetRemaining)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-primary-300 text-xs">Total inicial</p>
            <p className="text-primary-100 font-semibold text-sm">
              {formatCurrency(project.budget)}
            </p>
          </div>
        </div>
        <div className="h-2 bg-primary-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${budgetPct > 50 ? "bg-emerald-400" : budgetPct > 20 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-primary-300 mt-1">
          <span>
            Gastado: {formatCurrency(project.budget - project.budgetRemaining)}
          </span>
          <span>{budgetPct.toFixed(0)}% restante</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
        {(
          [
            ["asistencia", "Asistencia"],
            ["empleados", "Empleados"],
            ["historial", "Historial"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-sm py-2 rounded-lg font-medium transition ${tab === t ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ASISTENCIA */}
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
                      Cerrar semana y pagar
                    </p>
                    <p className="text-xs text-slate-400">
                      Se descontará {formatCurrency(weekTotal)} del presupuesto
                    </p>
                  </div>
                  <span className="text-xl font-bold text-obra-600">
                    {formatCurrency(weekTotal)}
                  </span>
                </div>
                <button
                  onClick={cobrarSemana}
                  disabled={cobrandoSemana || weekTotal === 0}
                  className="w-full bg-obra-500 hover:bg-obra-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-base flex items-center justify-center gap-2"
                >
                  {cobrandoSemana ? (
                    <>
                      <span className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" />
                      Procesando...
                    </>
                  ) : (
                    <>💰 Cobrar semana — {formatCurrency(weekTotal)}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EMPLEADOS */}
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
      {/* HISTORIAL */}
      {tab === "historial" && (
        <div className="space-y-2">
          {(() => {
            // Filtramos las semanas cerradas una sola vez para mejorar rendimiento
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
              <div
                key={p.id}
                className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-700 text-sm">
                    Semana {formatDate(p.weekStart)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Hasta el {formatDate(p.weekEnd)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(p.totalPaid)}
                  </span>
                  <button
                    onClick={() => generarPDF(project, p, p.attendances || [])}
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
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

// COMPONENTE FORMULARIO EXTRAÍDO AFUERA DEL RENDER PRINCIPAL
// Así React no pierde el focus al escribir un caracter
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
