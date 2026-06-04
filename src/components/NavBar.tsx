"use client";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export function NavBar({ userName }: { userName: string }) {
  return (
    <header className="bg-primary-900 text-white shadow-md">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="EasyPlaster"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-sm block">EasyPlaster</span>
            <span className="text-primary-300 text-[10px] block -mt-0.5">
              Steel Framing
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-primary-200 text-sm hidden sm:block">
            {userName}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-primary-300 hover:text-white transition px-2 py-1 rounded-lg hover:bg-primary-700"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
