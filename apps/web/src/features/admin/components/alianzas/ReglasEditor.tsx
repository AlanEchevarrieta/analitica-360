"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOMBRE_CICLO, type Ciclo, type ReglaCiclo, type ReglasCupon } from "../../hooks/use-alianzas";

const MESES: Record<Ciclo, number> = { mensual: 1, trimestral: 3, anual: 12 };
const REGLA_VACIA: ReglaCiclo = { entrada: [], periodosEntrada: 1, renovacionPct: 0, renovacionPeriodos: null, cuotas: null };

/** Descuento total del primer período sobre la lista (ej. anual 3×40% + 9×20% → 25%). */
function descuentoEntrada(ciclo: Ciclo, r: ReglaCiclo) {
  let restantes = MESES[ciclo];
  let suma = 0;
  for (const t of r.entrada) {
    const m = Math.min(t.meses, restantes);
    suma += m * t.porcentaje;
    restantes -= m;
  }
  return Math.round((suma / MESES[ciclo]) * 10) / 10;
}

const numero = (v: string) => (v === "" ? 0 : Number(v));

/** Reglas por ciclo de un cupón: descuento del primer período (por tramos de meses), renovaciones y cuotas. */
export function ReglasEditor({ reglas, onChange }: { reglas: ReglasCupon; onChange: (r: ReglasCupon) => void }) {
  const setRegla = (ciclo: Ciclo, r: ReglaCiclo | undefined) => onChange({ ...reglas, [ciclo]: r });

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {(Object.keys(MESES) as Ciclo[]).map((ciclo) => {
        const r = reglas[ciclo];
        return (
          <div key={ciclo} className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={Boolean(r)} onChange={(e) => setRegla(ciclo, e.target.checked ? { ...REGLA_VACIA } : undefined)} />
              {NOMBRE_CICLO[ciclo]}
            </label>
            {!r ? (
              <p className="text-xs text-muted-foreground">Sin reglas: paga precio de lista.</p>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Primer período pago (sobre la lista, sin acumular)</span>
                {r.entrada.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input className="h-8 w-16" type="number" min={1} max={MESES[ciclo]} aria-label="Meses" value={t.meses}
                      onChange={(e) => setRegla(ciclo, { ...r, entrada: r.entrada.map((x, j) => (j === i ? { ...x, meses: numero(e.target.value) } : x)) })} />
                    meses al
                    <Input className="h-8 w-16" type="number" min={0} max={100} aria-label="Porcentaje de descuento" value={t.porcentaje}
                      onChange={(e) => setRegla(ciclo, { ...r, entrada: r.entrada.map((x, j) => (j === i ? { ...x, porcentaje: numero(e.target.value) } : x)) })} />
                    %
                    <Button size="sm" variant="ghost" onClick={() => setRegla(ciclo, { ...r, entrada: r.entrada.filter((_, j) => j !== i) })}>
                      ✕
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-fit" onClick={() => setRegla(ciclo, { ...r, entrada: [...r.entrada, { meses: MESES[ciclo], porcentaje: 0 }] })}>
                  Agregar tramo de descuento
                </Button>
                <span className="text-xs">Descuento del primer período: {descuentoEntrada(ciclo, r)}%</span>
                <div className="flex items-center gap-1">
                  Renovaciones:
                  <Input className="h-8 w-16" type="number" min={0} max={100} aria-label="Descuento en renovaciones" value={r.renovacionPct} onChange={(e) => setRegla(ciclo, { ...r, renovacionPct: numero(e.target.value) })} />% de descuento
                </div>
                <div className="flex items-center gap-1">
                  durante
                  <Input className="h-8 w-16" type="number" min={1} placeholder="todas" aria-label="Cuántas renovaciones" value={r.renovacionPeriodos ?? ""}
                    onChange={(e) => setRegla(ciclo, { ...r, renovacionPeriodos: e.target.value ? numero(e.target.value) : null })} />
                  renovaciones (vacío = todas)
                </div>
                {ciclo !== "mensual" && (
                  <div className="flex items-center gap-1">
                    Pagar en
                    <Input className="h-8 w-16" type="number" min={1} max={12} placeholder="plan" aria-label="Cuotas" value={r.cuotas ?? ""}
                      onChange={(e) => setRegla(ciclo, { ...r, cuotas: e.target.value ? Math.max(1, numero(e.target.value)) : null })} />
                    cuotas (vacío = las del plan)
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
