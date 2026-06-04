'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Project } from '@/types';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/obras')
      .then((r) => r.json())
      .then((data) => { setProjects(data); setLoading(false); });
  }, []);

  const getStatusColor = (p: Project) => {
    const pct = (p.budgetRemaining / p.budget) * 100;
    if (pct > 50) return 'bg-emerald-500';
    if (pct > 20) return 'bg-amber-400';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mis Obras</h1>
          <p className="text-sm text-slate-500">{projects.length} obra{projects.length !== 1 ? 's' : ''} activa{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/obra/nueva"
          className="flex items-center gap-1.5 bg-obra-500 hover:bg-obra-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nueva obra
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏗️</div>
          <h3 className="font-semibold text-slate-700 mb-1">Todavía no tenés obras</h3>
          <p className="text-sm text-slate-400 mb-5">Creá tu primera obra para empezar a controlar el presupuesto</p>
          <Link
            href="/dashboard/obra/nueva"
            className="inline-flex items-center gap-2 bg-obra-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition hover:bg-obra-600"
          >
            Crear primera obra
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const pct = Math.max(0, Math.min(100, (p.budgetRemaining / p.budget) * 100));
            return (
              <Link key={p.id} href={`/dashboard/obra/${p.id}`}>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition hover:border-primary-200 cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800">{p.name}</h3>
                      {p.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
                      {p.employeeCount} empleado{p.employeeCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Presupuesto restante</span>
                      <span className="font-semibold text-slate-700">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getStatusColor(p)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      Restante: <span className="font-bold text-slate-800">{formatCurrency(p.budgetRemaining)}</span>
                    </span>
                    <span className="text-slate-400 text-xs">
                      Total: {formatCurrency(p.budget)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
