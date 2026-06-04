"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) setError(data.error ?? "Error al registrarse");
    else router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white mb-4 shadow-lg p-1.5">
            <Image
              src="/logo.png"
              alt="EasyPlaster"
              width={72}
              height={72}
              className="object-contain rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">EasyPlaster</h1>
          <p className="text-primary-200 text-sm mt-1">
            Steel Framing · Control de obras
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">
            Crear cuenta
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(
              [
                ["name", "Nombre", "text", "Tu nombre"],
                ["email", "Email", "email", "tu@email.com"],
                ["password", "Contraseña", "password", "••••••••"],
              ] as const
            ).map(([field, label, type, placeholder]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [field]: e.target.value }))
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder={placeholder}
                />
              </div>
            ))}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-3.5 py-2.5 rounded-xl">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {loading ? "Registrando..." : "Crear cuenta"}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-5">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="text-primary-700 font-semibold hover:underline"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
