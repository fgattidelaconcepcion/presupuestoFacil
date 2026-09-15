'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NuevaObraPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    budget: '',
    advanceAmount: '',
  });

  const num = (v: string) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/obras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        budget: num(form.budget),
        advanceAmount: num(form.advanceAmount),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Error al crear la obra');
    } else {
      router.push(`/dashboard/obra/${data.id}`);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Nueva obra</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de la obra *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="Ej: Edificio Av. San Martín"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
              placeholder="Notas adicionales..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Presupuesto total (USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                type="number"
                value={form.budget}
                onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                required
                min="1"
                step="0.01"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              Adelanto cobrado (opcional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                type="number"
                value={form.advanceAmount}
                onChange={(e) => setForm((p) => ({ ...p, advanceAmount: e.target.value }))}
                min="0"
                step="0.01"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {[30, 50, 70, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      advanceAmount: ((num(p.budget) * pct) / 100).toFixed(2),
                    }))
                  }
                  className="flex-1 py-1.5 rounded-lg border border-emerald-200 bg-white text-xs text-emerald-700 font-semibold hover:bg-emerald-100 transition"
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="text-xs text-emerald-700/80 mt-2 leading-relaxed">
              Lo que el cliente ya te entregó. Los jornales, materiales y gastos
              se descuentan de esta plata, no del total. Lo podés cambiar
              después cuando te paguen el resto.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3.5 py-2.5 rounded-xl">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <Link
              href="/dashboard"
              className="flex-1 text-center py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-obra-500 hover:bg-obra-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition"
            >
              {loading ? 'Creando...' : 'Crear obra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
