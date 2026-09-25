"use client";

import { Button } from "@/components/ui/button";
import { RANGOS, type Rango } from "@/lib/periodos";

export function SelectorPeriodo({ valor, onCambiar }: { valor: Rango; onCambiar: (r: Rango) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
      {RANGOS.map((r) => (
        <Button key={r.valor} size="sm" variant={valor === r.valor ? "secondary" : "ghost"} aria-pressed={valor === r.valor} onClick={() => onCambiar(r.valor)}>
          {r.etiqueta}
        </Button>
      ))}
    </div>
  );
}
