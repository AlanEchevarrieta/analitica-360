"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

const ENLACES = [
  ["Funciones", "#funciones"],
  ["Planes", "#planes"],
  ["Socios UCIM", "#ucim"],
  ["Preguntas", "#preguntas"],
] as const;

export function Encabezado() {
  const [abierto, setAbierto] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Analítica 360, inicio" className="text-slate-900">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex" aria-label="Secciones">
          {ENLACES.map(([t, h]) => (
            <a key={h} href={h} className="transition-colors hover:text-slate-900">
              {t}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link prefetch={false} href="/sign-in" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Ingresar
          </Link>
          <Link prefetch={false} href="/sign-up" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
            Probar gratis
          </Link>
        </div>
        <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden" aria-label={abierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {abierto && (
        <nav className="flex flex-col gap-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden" aria-label="Secciones">
          {ENLACES.map(([t, h]) => (
            <a key={h} href={h} onClick={() => setAbierto(false)} className="rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-50">
              {t}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link prefetch={false} href="/sign-in" className="rounded-lg border border-slate-200 py-2.5 text-center text-sm font-medium text-slate-700">
              Ingresar
            </Link>
            <Link prefetch={false} href="/sign-up" className="rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-medium text-white">
              Probar gratis
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
