"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDENES, urlConsulta, type Consulta, type Orden } from "@/lib/catalogo";
import { formatoARS } from "@/lib/productos";

const campo = "mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--marca)]";

/** Orden y filtros (precio, stock, ofertas): cada cambio va a la URL, así se puede compartir y volver atrás. */
export function ControlesCatalogo({ consulta, bounds }: { consulta: Consulta; bounds: { min: number; max: number } }) {
  const router = useRouter();
  const ir = (cambios: Partial<Consulta>) => router.push(urlConsulta(consulta, cambios), { scroll: false });
  const hayFiltros = consulta.min != null || consulta.max != null || consulta.stock || consulta.oferta;
  const [panel, setPanel] = useState(hayFiltros);
  const [min, setMin] = useState(consulta.min?.toString() ?? "");
  const [max, setMax] = useState(consulta.max?.toString() ?? "");
  const aNumero = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPanel((v) => !v)}
          aria-expanded={panel}
          className="rounded-[var(--r-boton)] border border-[var(--marca-oscuro)]/20 bg-white px-4 py-2 text-sm font-medium hover:border-[var(--marca)]"
        >
          Filtros{hayFiltros ? " •" : ""}
        </button>
        <label className="flex items-center gap-2 text-sm text-[var(--tinta)]/70">
          Ordenar por
          <select
            value={consulta.orden}
            onChange={(e) => ir({ orden: e.target.value as Orden })}
            className="rounded-lg border border-[var(--marca-oscuro)]/20 bg-white px-2 py-2 text-sm text-[var(--tinta)]"
          >
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {panel ? (
        <form
          className="order-last grid w-full gap-4 rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            ir({ min: aNumero(min), max: aNumero(max) });
          }}
        >
          <label className="block text-sm">
            Precio desde
            <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder={formatoARS(bounds.min)} className={campo} />
          </label>
          <label className="block text-sm">
            Precio hasta
            <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} placeholder={formatoARS(bounds.max)} className={campo} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={consulta.oferta} onChange={(e) => ir({ oferta: e.target.checked })} className="size-4 accent-[var(--marca)]" />
            Solo ofertas
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={consulta.stock} onChange={(e) => ir({ stock: e.target.checked })} className="size-4 accent-[var(--marca)]" />
            Solo con stock
          </label>
          <div className="flex gap-3">
            <button type="submit" className="rounded-[var(--r-boton)] bg-[var(--marca-oscuro)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--marca-hero)]">
              Aplicar
            </button>
            {hayFiltros ? (
              <button
                type="button"
                onClick={() => {
                  setMin("");
                  setMax("");
                  ir({ min: null, max: null, stock: false, oferta: false });
                }}
                className="text-sm text-[var(--tinta)]/60 hover:text-[var(--tinta)]"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </>
  );
}
