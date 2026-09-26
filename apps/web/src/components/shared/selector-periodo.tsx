"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RANGOS, fechasDe, hoyAR, type Rango } from "@/lib/periodos";

export interface PeriodoElegido {
  rango: Rango;
  desde: string;
  hasta: string;
  setRango: (r: Rango) => void;
  personalizado: { desde: string; hasta: string };
  setPersonalizado: (p: { desde: string; hasta: string }) => void;
}

/** Estado del período de una vista (presets + rango personalizado). */
export function useRangoFechas(inicial: Rango = "mes", excluir: Rango[] = []): PeriodoElegido & { excluir: Rango[] } {
  const [rango, setRango] = useState<Rango>(inicial);
  const [personalizado, setPersonalizado] = useState(() => ({ desde: `${hoyAR().slice(0, 7)}-01`, hasta: hoyAR() }));
  const { desde, hasta } = fechasDe(rango, personalizado);
  return { rango, desde, hasta, setRango, personalizado, setPersonalizado, excluir };
}

export function SelectorPeriodo({ periodo }: { periodo: PeriodoElegido & { excluir?: Rango[] } }) {
  const { rango, setRango, personalizado, setPersonalizado } = periodo;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
        {RANGOS.filter((r) => !periodo.excluir?.includes(r.valor)).map((r) => (
          <Button key={r.valor} size="sm" variant={rango === r.valor ? "secondary" : "ghost"} aria-pressed={rango === r.valor} onClick={() => setRango(r.valor)}>
            {r.etiqueta}
          </Button>
        ))}
      </div>
      {rango === "personalizado" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            Desde
            <Input type="date" className="w-40" value={personalizado.desde} max={personalizado.hasta} onChange={(e) => setPersonalizado({ ...personalizado, desde: e.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            Hasta
            <Input type="date" className="w-40" value={personalizado.hasta} min={personalizado.desde} max={hoyAR()} onChange={(e) => setPersonalizado({ ...personalizado, hasta: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
