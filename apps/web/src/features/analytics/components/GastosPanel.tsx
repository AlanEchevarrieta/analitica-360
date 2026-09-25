"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { hoyAR } from "@/lib/periodos";
import { useAccionesGastos, useGastos } from "../hooks/use-analytics";

export const CATEGORIAS_GASTO: Record<string, string> = {
  alquiler: "Alquiler",
  sueldos: "Sueldos",
  servicios: "Servicios",
  marketing: "Marketing",
  logistica: "Logística",
  impuestos: "Impuestos",
  mantenimiento: "Mantenimiento",
  otro: "Otro",
};
const FRECUENCIAS = { mensual: "Mensual", quincenal: "Quincenal", semanal: "Semanal" } as const;
const fechaCorta = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function GastosPanel({ desde, hasta }: { desde: string; hasta: string }) {
  // Desde siempre: un recurrente cargado antes del período sigue vigente y cuenta.
  const gastos = useGastos("2000-01-01", hasta);
  const lista = (gastos.data ?? []).filter((x) => x.fecha.slice(0, 10) >= desde || x.recurrente);
  const { crear, anular } = useAccionesGastos();
  const [g, setG] = useState({ categoria: "alquiler", descripcion: "", monto: "", fecha: hoyAR(), frecuencia: "" as "" | keyof typeof FRECUENCIAS });

  function agregar() {
    if (!g.descripcion.trim() || aNumero(g.monto) <= 0) return toast.error("Completá descripción y monto.");
    crear.mutate(
      { categoria: g.categoria, descripcion: g.descripcion.trim(), monto: aNumero(g.monto), fecha: g.fecha, recurrente: Boolean(g.frecuencia), frecuencia: g.frecuencia || null },
      {
        onSuccess: () => {
          toast.success("Gasto cargado");
          setG((x) => ({ ...x, descripcion: "", monto: "" }));
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cargar"),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos del negocio</CardTitle>
        <CardDescription>Alquiler, sueldos, servicios… Los recurrentes se cuentan solos en cada período según su frecuencia.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Categoría" value={g.categoria} onChange={(e) => setG({ ...g, categoria: e.target.value })}>
            {Object.entries(CATEGORIAS_GASTO).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <Input className="min-w-48 flex-1" placeholder="Descripción" aria-label="Descripción" value={g.descripcion} onChange={(e) => setG({ ...g, descripcion: e.target.value })} />
          <Input className="w-32" inputMode="decimal" placeholder="Monto" aria-label="Monto" value={g.monto} onChange={(e) => setG({ ...g, monto: e.target.value })} />
          <Input className="w-40" type="date" aria-label="Fecha" value={g.fecha} onChange={(e) => setG({ ...g, fecha: e.target.value })} />
          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Se repite" value={g.frecuencia} onChange={(e) => setG({ ...g, frecuencia: e.target.value as typeof g.frecuencia })}>
            <option value="">Una sola vez</option>
            {Object.entries(FRECUENCIAS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <Button onClick={agregar} disabled={crear.isPending}>
            Agregar
          </Button>
        </div>

        {lista.length === 0 ? (
          <SinDatos mensaje="No hay gastos cargados en este período." />
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {lista.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <span className="w-24 tabular-nums text-muted-foreground">{fechaCorta(x.fecha)}</span>
                <span className="w-28 text-muted-foreground">{CATEGORIAS_GASTO[x.categoria] ?? x.categoria}</span>
                <span className="flex-1 truncate">
                  {x.descripcion}
                  {x.frecuencia && <span className="ml-2 rounded bg-muted px-1.5 text-xs">{FRECUENCIAS[x.frecuencia]}</span>}
                </span>
                <span className="font-medium tabular-nums">{formatoPesos(x.monto)}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Anular gasto ${x.descripcion}`}
                  onClick={() => {
                    if (window.confirm(`¿Anular "${x.descripcion}"?${x.frecuencia ? " Deja de repetirse." : ""}`)) {
                      anular.mutate(x.id, { onSuccess: () => toast.success("Gasto anulado") });
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
