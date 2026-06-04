'use client';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export function NavBar({ userName }: { userName: string }) {
  return (
    <header className="bg-primary-900 text-white shadow-md">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base">
          <span className="w-7 h-7 rounded-lg bg-obra-500 flex items-center justify-center text-xs">🏗️</span>
          Presupuesto Obra
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-primary-200 text-sm hidden sm:block">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-primary-300 hover:text-white transition px-2 py-1 rounded-lg hover:bg-primary-700"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
