"use client";

import { Input } from "@/components/ui/input";
import { aNumero } from "@/lib/numeros";
import { cn } from "@/lib/utils";

/** Cuánto va a cada variante del stock que el producto tenía sin variante. */
export function RepartoStock({
  total,
  variantes,
  cantidades,
  onCambiar,
}: {
  total: number;
  variantes: { clave: string; etiqueta: string }[];
  cantidades: Record<string, string>;
  onCambiar: (cantidades: Record<string, string>) => void;
}) {
  const asignado = variantes.reduce((acc, v) => acc + aNumero(cantidades[v.clave] ?? ""), 0);
  const falta = total - asignado;
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/30">
      <p className="text-sm">
        Este producto ya tiene <b>{total} unidades</b> cargadas sin variante. Indicá de cuál es cada una para no perder stock:
      </p>
      <div className="flex flex-wrap gap-3">
        {variantes.map((v) => (
          <label key={v.clave} className="flex items-center gap-2 text-sm">
            {v.etiqueta || "Variante"}
            <Input
              className="w-20"
              inputMode="numeric"
              aria-label={`Unidades de ${v.etiqueta}`}
              value={cantidades[v.clave] ?? ""}
              onChange={(e) => onCambiar({ ...cantidades, [v.clave]: e.target.value.replace(/\D/g, "") })}
            />
          </label>
        ))}
      </div>
      <p className={cn("text-xs", falta === 0 ? "text-emerald-600" : "text-destructive")}>
        {falta === 0 ? "Listo: el reparto suma el total." : falta > 0 ? `Faltan asignar ${falta} unidades.` : `Te pasaste por ${-falta} unidades.`}
      </p>
    </div>
  );
}

/** Reparto listo para la API (solo las variantes con unidades). */
export function repartoParaApi(
  variantes: { clave: string; atributos: Record<string, string> }[],
  cantidades: Record<string, string>,
): { atributos: Record<string, string>; cantidad: number }[] {
  return variantes.map((v) => ({ atributos: v.atributos, cantidad: aNumero(cantidades[v.clave] ?? "") })).filter((r) => r.cantidad > 0);
}
