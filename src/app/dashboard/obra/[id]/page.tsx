'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate, DAYS_OF_WEEK } from '@/lib/utils';
import type { Project, Employee, Payroll, Attendance } from '@/types';
import { generarPDF } from '@/components/pdf/generarPDF';

type Tab = 'asistencia' | 'empleados' | 'historial';

interface ProjectDetail extends Project {
  employees: Employee[];
  payrolls: Payroll[];
}

export default function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('asistencia');

  // Attendance state
  const [currentPayroll, setCurrentPayroll] = useState<Payroll | null>(null);
  const [attendances, setAttendances] = useState<Record<string, Record<string, boolean>>>({});
  const [cobrandoSemana, setCobrandoSemana] = useState(false);

  // Employee form
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', dailyRate: '' });
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/obras/${id}`);
    if (!res.ok) { router.push('/dashboard'); return; }
    const data: ProjectDetail = await res.json();
    setProject(data);

    const open = data.payrolls.find((p) => p.status === 'open') ?? null;
    setCurrentPayroll(open);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Load attendances when payroll changes
  useEffect(() => {
    if (!currentPayroll) return;
    fetch(`/api/semanas/${currentPayroll.id}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, Record<string, boolean>> = {};
        (data.attendances ?? []).forEach((a: Attendance) => {
          if (!map[a.employeeId]) map[a.employeeId] = {};
          map[a.employeeId][a.day] = a.present;
        });
        setAttendances(map);
      });
  }, [currentPayroll]);

  async function openWeek() {
    if (!project) return;
    const res = await fetch('/api/semanas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    });
    const data = await res.json();
    setCurrentPayroll(data);
  }

  async function toggleAttendance(employeeId: string, day: string) {
    if (!currentPayroll) return;
    const current = attendances[employeeId]?.[day] ?? false;
    const newVal = !current;

    setAttendances((prev) => ({
      ...prev,
      [employeeId]: { ...(prev[employeeId] ?? {}), [day]: newVal },
    }));

    await fetch('/api/asistencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payrollId: currentPayroll.id, employeeId, day, present: newVal }),
    });
  }

  async function cobrarSemana() {
    if (!currentPayroll) return;
    setCobrandoSemana(true);
    const res = await fetch(`/api/semanas/${currentPayroll.id}/cobrar`, { method: 'POST' });
    if (res.ok) {
      await fetchProject();
      setCurrentPayroll(null);
      setAttendances({});
      setTab('historial');
    }
    setCobrandoSemana(false);
  }

  async function addEmployee() {
    if (!project || !empForm.name || !empForm.dailyRate) return;
    setEmpLoading(true);
    setEmpError('');
    const res = await fetch('/api/empleados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: empForm.name, dailyRate: parseFloat(empForm.dailyRate), projectId: project.id }),
    });
    const data = await res.json();
    setEmpLoading(false);
    if (!res.ok) { setEmpError(data.error ?? 'Error'); return; }
    setEmpForm({ name: '', dailyRate: '' });
    setShowEmpForm(false);
    fetchProject();
  }

  async function deleteEmployee(empId: string) {
    if (!confirm('¿Eliminar empleado?')) return;
    await fetch(`/api/empleados/${empId}`, { method: 'DELETE' });
    fetchProject();
  }

  function calcDaysWorked(empId: string) {
    return DAYS_OF_WEEK.filter((d) => attendances[empId]?.[d.key]).length;
  }

  function calcWeekTotal() {
    if (!project) return 0;
    return project.employees.reduce((sum, emp) => {
      return sum + calcDaysWorked(emp.id) * emp.dailyRate;
    }, 0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!project) return null;

  const budgetPct = Math.max(0, Math.min(100, (project.budgetRemaining / project.budget) * 100));
  const closedPayrolls = project.payrolls.filter((p) => p.status === 'closed');
  const weekTotal = calcWeekTotal();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-800 truncate">{project.name}</h1>
          {project.description && <p className="text-xs text-slate-400 truncate">{project.description}</p>}
        </div>
      </div>

      {/* Budget card */}
      <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-4 mb-4 text-white shadow-md">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-primary-300 text-xs font-medium uppercase tracking-wide">Presupuesto restante</p>
            <p className="text-3xl font-bold mt-0.5">{formatCurrency(project.budgetRemaining)}</p>
          </div>
          <div className="text-right">
            <p className="text-primary-300 text-xs">Total inicial</p>
            <p className="text-primary-100 font-semibold text-sm">{formatCurrency(project.budget)}</p>
          </div>
        </div>
        <div className="h-2 bg-primary-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${budgetPct > 50 ? 'bg-emerald-400' : budgetPct > 20 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-primary-300 mt-1">
          <span>Gastado: {formatCurrency(project.budget - project.budgetRemaining)}</span>
          <span>{budgetPct.toFixed(0)}% restante</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
        {([['asistencia', 'Asistencia'], ['empleados', 'Empleados'], ['historial', 'Historial']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-sm py-2 rounded-lg font-medium transition ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB: ASISTENCIA */}
      {tab === 'asistencia' && (
        <div>
          {!currentPayroll ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-slate-100">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-semibold text-slate-700 mb-1">No hay semana abierta</h3>
              <p className="text-sm text-slate-400 mb-4">Abrí una nueva semana para registrar asistencias</p>
              <button
                onClick={openWeek}
                disabled={project.employees.length === 0}
                className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition"
              >
                Abrir semana actual
              </button>
              {project.employees.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">Primero agregá empleados en la pestaña "Empleados"</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Semana actual</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(currentPayroll.weekStart)} – {formatDate(currentPayroll.weekEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total a pagar</p>
                  <p className="text-lg font-bold text-obra-600">{formatCurrency(weekTotal)}</p>
                </div>
              </div>

              {/* Attendance grid */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Empleado</th>
                        {DAYS_OF_WEEK.map((d) => (
                          <th key={d.key} className="text-center px-2 py-2.5 text-xs font-semibold text-slate-500 min-w-[40px]">{d.label}</th>
                        ))}
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.employees.map((emp, i) => {
                        const days = calcDaysWorked(emp.id);
                        const total = days * emp.dailyRate;
                        return (
                          <tr key={emp.id} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800 text-sm">{emp.name}</div>
                              <div className="text-xs text-slate-400">{formatCurrency(emp.dailyRate)}/día</div>
                            </td>
                            {DAYS_OF_WEEK.map((d) => {
                              const present = attendances[emp.id]?.[d.key] ?? false;
                              return (
                                <td key={d.key} className="text-center px-2 py-3">
                                  <button
                                    onClick={() => toggleAttendance(emp.id, d.key)}
                                    className={`w-8 h-8 rounded-lg transition font-bold text-sm ${
                                      present
                                        ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-300'
                                        : 'bg-slate-100 text-slate-300 border-2 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {present ? '✓' : '–'}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="text-center px-3 py-3">
                              <div className="font-bold text-slate-800 text-sm">{formatCurrency(total)}</div>
                              <div className="text-xs text-slate-400">{days}d</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pay button */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Cerrar semana y pagar</p>
                    <p className="text-xs text-slate-400">Se descontará {formatCurrency(weekTotal)} del presupuesto</p>
                  </div>
                  <span className="text-xl font-bold text-obra-600">{formatCurrency(weekTotal)}</span>
                </div>
                <button
                  onClick={cobrarSemana}
                  disabled={cobrandoSemana || weekTotal === 0}
                  className="w-full bg-obra-500 hover:bg-obra-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-base transition flex items-center justify-center gap-2"
                >
                  {cobrandoSemana ? (
                    <><span className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" /> Procesando...</>
                  ) : (
                    <>💰 Cobrar semana — {formatCurrency(weekTotal)}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: EMPLEADOS */}
      {tab === 'empleados' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-600">{project.employees.length} empleado{project.employees.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setShowEmpForm(true); setEmpError(''); }}
              className="flex items-center gap-1 text-sm text-primary-700 font-semibold hover:text-primary-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>

          {showEmpForm && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-primary-100 mb-3">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">Nuevo empleado</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={empForm.name}
                  onChange={(e) => setEmpForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Nombre del empleado"
                />
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={empForm.dailyRate}
                    onChange={(e) => setEmpForm((p) => ({ ...p, dailyRate: e.target.value }))}
                    min="1"
                    step="0.01"
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="Jornal diario (USD)"
                  />
                </div>
                {empError && <p className="text-red-500 text-xs">{empError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowEmpForm(false); setEmpForm({ name: '', dailyRate: '' }); }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addEmployee}
                    disabled={empLoading}
                    className="flex-1 py-2 rounded-xl bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {empLoading ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              </div>
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
                <div key={emp.id} className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{emp.name}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(emp.dailyRate)} / día</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteEmployee(emp.id)}
                    className="text-slate-300 hover:text-red-500 transition p-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORIAL */}
      {tab === 'historial' && (
        <div>
          {closedPayrolls.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-slate-500 text-sm">No hay semanas cobradas todavía</p>
            </div>
          ) : (
            <div className="space-y-3">
              {closedPayrolls.map((payroll) => (
                <div key={payroll.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">
                        {formatDate(payroll.weekStart)} – {formatDate(payroll.weekEnd)}
                      </p>
                      <p className="text-xs text-slate-400">{payroll.payments?.length ?? 0} empleados</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-obra-600 text-base">{formatCurrency(payroll.totalPaid)}</span>
                      <button
                        onClick={() => generarPDF(project, payroll)}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium bg-primary-50 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PDF
                      </button>
                    </div>
                  </div>

                  {payroll.payments && payroll.payments.length > 0 && (
                    <div className="divide-y divide-slate-50">
                      {payroll.payments.map((payment) => (
                        <div key={payment.id} className="px-4 py-2.5 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                              {payment.employee?.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-slate-700">{payment.employee?.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-slate-800 text-sm">{formatCurrency(payment.amount)}</span>
                            <span className="text-xs text-slate-400 block">{payment.daysWorked} días</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
