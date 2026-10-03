"use client";

import { cn } from "@/lib/utils";
import { CICLOS, type Ciclo } from "../planes";
import type { Beneficios, TablaPrecios } from "../use-precios";

/**
 * El ciclo que más ahorra en plata durante un año (primer período más las
 * renovaciones que entran en 12 meses), en promedio entre los planes: lleva la
 * cinta. null si ninguno tiene descuento.
 */
function cicloQueMasAhorra(tabla: TablaPrecios): Ciclo | null {
  let mejor: { ciclo: Ciclo; ahorro: number } | null = null;
  for (const c of CICLOS) {
    const ahorros = tabla.planes.map((p) => {
      const x = p.ciclos.find((y) => y.ciclo === c.id)!;
      const renovacionesEnUnAnio = Math.max(0, 12 / x.meses - 1);
      return x.primerPago.descuento + renovacionesEnUnAnio * x.renovacion.descuento;
    });
    const promedio = ahorros.reduce((a, b) => a + b, 0) / (ahorros.length || 1);
    if (promedio > 0 && (!mejor || promedio > mejor.ahorro)) mejor = { ciclo: c.id, ahorro: promedio };
  }
  return mejor?.ciclo ?? null;
}

/** Forma de pago: tres tarjetitas con el beneficio de cada una y la cinta en la que más ahorra. */
export function SelectorCiclo({ ciclo, onChange, tabla, beneficios }: { ciclo: Ciclo; onChange: (c: Ciclo) => void; tabla: TablaPrecios | undefined; beneficios: Beneficios | null }) {
  const recomendado = tabla ? cicloQueMasAhorra(tabla) : null;
  const cuotas = (c: Ciclo) => tabla?.planes[0]?.ciclos.find((x) => x.ciclo === c)?.primerPago.cuotas ?? 1;
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-2 pt-3 sm:gap-3" role="radiogroup" aria-label="Forma de pago">
      {CICLOS.map((c) => {
        const activo = ciclo === c.id;
        const etiqueta = beneficios?.etiquetas[c.id] ?? null;
        const n = cuotas(c.id);
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(c.id)}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors",
              activo ? "border-primary bg-primary/10 ring-2 ring-primary" : "hover:bg-muted",
              recomendado === c.id && !activo && "border-emerald-500/60",
            )}
          >
            {recomendado === c.id && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold tracking-wide whitespace-nowrap text-white sm:text-[10px] dark:bg-emerald-500 dark:text-emerald-950">
                EL QUE MÁS AHORRA
              </span>
            )}
            <span className="text-sm font-semibold">{c.nombre}</span>
            {etiqueta ? (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 sm:text-xs dark:text-emerald-400">{etiqueta}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground sm:text-xs">{c.meses === 1 ? "mes a mes" : `${c.meses} meses`}</span>
            )}
            {n > 1 && <span className="text-[10px] text-muted-foreground sm:text-[11px]">{n} cuotas sin interés</span>}
          </button>
        );
      })}
    </div>
  );
}
