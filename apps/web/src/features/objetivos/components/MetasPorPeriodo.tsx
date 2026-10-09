"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputPlata } from "@/components/shared/input-plata";
import { Label } from "@/components/ui/label";
import { useAccionesObjetivo, type Objetivo } from "../hooks/use-objetivos";
import { aNumero } from "@/lib/numeros";
import { EN_DINERO, formatoValor, nombrePeriodo, proximosPeriodos } from "../objetivos";

const hoyAR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

/** Metas propias de algunos períodos (ej. diciembre más alto). El resto usa la meta general. */
export function MetasPorPeriodo({ objetivo }: { objetivo: Objetivo }) {
  const { fijarMeta } = useAccionesObjetivo();
  const periodos = proximosPeriodos(objetivo.periodo, hoyAR(), 12);
  const [desde, setDesde] = useState(periodos[0]);
  const [meta, setMeta] = useState("");

  const guardar = (d: string, valor: number | null) =>
    fijarMeta.mutate(
      { id: objetivo.id, desde: d, meta: valor },
      {
        onSuccess: () => {
          toast.success(valor == null ? "Vuelve a regir la meta general" : `Meta de ${nombrePeriodo(objetivo.periodo, d)} guardada`);
          setMeta("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
      },
    );

  const agregar = () => {
    const n = aNumero(meta);
    if (!(n > 0)) return toast.error("Poné una meta mayor a cero");
    guardar(desde, n);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:col-span-2 lg:col-span-4">
      <p className="text-sm font-medium">Metas especiales por período</p>
      <p className="text-xs text-muted-foreground">Para los meses (o semanas) que esperás distinto, por ejemplo diciembre más alto. El resto usa la meta general.</p>
      {objetivo.metasPeriodo.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {objetivo.metasPeriodo.map((m) => (
            <li key={m.desde} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
              {nombrePeriodo(objetivo.periodo, m.desde)}: {formatoValor(objetivo, m.meta)}
              <button type="button" className="rounded-full p-0.5 hover:bg-background" aria-label={`Sacar la meta de ${nombrePeriodo(objetivo.periodo, m.desde)}`} onClick={() => guardar(m.desde, null)}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="meta-periodo-desde" className="text-xs">Período</Label>
          <select id="meta-periodo-desde" className="h-9 rounded-lg border bg-transparent px-2 text-sm" value={desde} onChange={(e) => setDesde(e.target.value)}>
            {periodos.map((p) => (
              <option key={p} value={p}>
                {nombrePeriodo(objetivo.periodo, p)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="meta-periodo-valor" className="text-xs">Meta</Label>
          <InputPlata formato={EN_DINERO.includes(objetivo.tipo)} moneda={objetivo.moneda} id="meta-periodo-valor" className="w-36" value={meta} onChange={(e) => setMeta(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={agregar} disabled={fijarMeta.isPending}>
          Guardar meta del período
        </Button>
      </div>
    </div>
  );
}
