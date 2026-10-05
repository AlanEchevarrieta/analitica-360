"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Sugerencia = { nombre: string; categoria: string; precio: string; href: string; foto: string | null };

/**
 * Buscador con sugerencias mientras se escribe. Enter busca en todo el catálogo;
 * con las flechas se elige una sugerencia. `alCerrar` lo cierra (Escape o al ir a un resultado).
 */
export function Buscador({ alCerrar, autoFocus = true }: { alCerrar?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const lista = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Sugerencia[]>([]);
  const [activo, setActivo] = useState(-1);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  // Espera a que deje de tipear (200 ms) y cancela la búsqueda anterior.
  useEffect(() => {
    const texto = q.trim();
    const control = new AbortController();
    const reloj = setTimeout(async () => {
      if (texto.length < 2) return setItems([]);
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(texto)}`, { signal: control.signal });
        setItems(r.ok ? await r.json() : []);
        setActivo(-1);
      } catch {
        /* cancelada o sin red: se queda lo anterior */
      }
    }, 200);
    return () => {
      clearTimeout(reloj);
      control.abort();
    };
  }, [q]);

  const ir = (href: string) => {
    alCerrar?.();
    router.push(href);
  };

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        if (activo >= 0 && items[activo]) return ir(items[activo].href);
        if (q.trim()) ir(`/productos?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label className="flex items-center gap-3 rounded-[var(--r-boton)] border border-[var(--marca-oscuro)]/20 bg-white px-4 py-2.5 focus-within:border-[var(--marca)]">
        <LupaIcon />
        <span className="sr-only">Buscar en la tienda</span>
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") alCerrar?.();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((i) => Math.min(i + 1, items.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((i) => Math.max(i - 1, -1));
            }
          }}
          placeholder="¿Qué estás buscando?"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={lista}
          aria-activedescendant={activo >= 0 ? `${lista}-${activo}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          className="w-full bg-transparent text-base outline-none placeholder:text-[var(--tinta)]/40"
        />
      </label>

      {items.length > 0 ? (
        <ul id={lista} role="listbox" className="mt-2 divide-y divide-[var(--marca-oscuro)]/10 overflow-hidden rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white">
          {items.map((s, i) => (
            <li key={s.href} id={`${lista}-${i}`} role="option" aria-selected={i === activo}>
              <Link
                href={s.href}
                onClick={() => alCerrar?.()}
                className={`flex items-center gap-3 px-3 py-2.5 transition ${i === activo ? "bg-[var(--marca)]/10" : "hover:bg-[var(--marca)]/5"}`}
              >
                <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--crema)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura servida por la API */}
                  {s.foto ? <img src={s.foto} alt="" className="size-full object-cover" loading="lazy" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.nombre}</span>
                  <span className="text-xs text-[var(--tinta)]/55">{s.categoria}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--marca)]">{s.precio}</span>
              </Link>
            </li>
          ))}
          <li>
            <button type="submit" className="w-full px-3 py-2.5 text-left text-sm text-[var(--tinta)]/70 hover:text-[var(--marca)]">
              Ver todos los resultados para “{q.trim()}” →
            </button>
          </li>
        </ul>
      ) : q.trim().length >= 2 ? (
        <p className="mt-2 text-sm text-[var(--tinta)]/55">Enter para buscar “{q.trim()}”</p>
      ) : null}
    </form>
  );
}

export function LupaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
