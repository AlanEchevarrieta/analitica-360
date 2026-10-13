"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVIDADES, type Actividad } from "@/lib/rubros";

/** Las tres actividades como tarjetas tildables (registro y Configuración). Se puede elegir una, dos o las tres. */
export function SelectorActividades({ valor, onChange }: { valor: Actividad[]; onChange: (v: Actividad[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {ACTIVIDADES.map((a) => {
        const si = valor.includes(a.valor);
        return (
          <button
            key={a.valor}
            type="button"
            role="checkbox"
            aria-checked={si}
            onClick={() => onChange(si ? valor.filter((x) => x !== a.valor) : [...valor, a.valor])}
            className={cn("relative flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition", si ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-primary/50")}
          >
            <span className={cn("absolute top-2 right-2 flex size-4 items-center justify-center rounded border", si ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")} aria-hidden>
              {si && <Check className="size-3" />}
            </span>
            <span className="text-xl" aria-hidden>
              {a.icono}
            </span>
            <span className="font-medium">{a.titulo}</span>
            <span className="text-xs text-muted-foreground">{a.detalle}</span>
          </button>
        );
      })}
    </div>
  );
}
