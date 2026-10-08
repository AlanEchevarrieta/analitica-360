"use client";

import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Objetivo } from "../hooks/use-objetivos";
import { adjetivoPeriodo, formatoValor, nombreTipo, SEMAFORO } from "../objetivos";

/** Compara vendedores y sucursales que tienen el mismo tipo de objetivo y período (solo dueño y contador). */
export function RankingObjetivos({ objetivos }: { objetivos: Objetivo[] }) {
  const grupos = new Map<string, Objetivo[]>();
  for (const o of objetivos) {
    if (!o.usuario && !o.ubicacion) continue;
    const clave = `${o.tipo}|${o.periodo}|${o.usuario ? "usuario" : "sucursal"}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), o]);
  }
  const conVarios = [...grupos.values()].filter((g) => g.length >= 2);
  if (conVarios.length === 0)
    return <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">El ranking aparece cuando hay al menos dos usuarios (o dos sucursales) con el mismo tipo de objetivo y período.</p>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {conVarios.map((g) => {
        const o0 = g[0];
        const orden = [...g].sort((a, b) => (b.actual.porcentaje ?? -1) - (a.actual.porcentaje ?? -1));
        return (
          <Card key={`${o0.tipo}-${o0.periodo}-${o0.usuario ? "u" : "s"}`} className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trophy className="size-4 text-amber-500" /> {nombreTipo(o0.tipo)} {adjetivoPeriodo(o0.periodo)} · por {o0.usuario ? "usuario" : "sucursal"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <ol className="flex flex-col gap-2">
                {orden.map((o, i) => {
                  const pct = Math.min(100, Math.max(0, o.actual.porcentaje ?? 0));
                  return (
                    <li key={o.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-sm">
                      <span className="font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{o.usuario?.nombre ?? o.ubicacion}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-foreground/10">
                          <div className={cn("h-full rounded-full", SEMAFORO[o.actual.semaforo].barra)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-right text-xs tabular-nums">
                        {o.actual.porcentaje != null ? `${o.actual.porcentaje.toLocaleString("es-AR")} %` : "—"}
                        <span className="block text-muted-foreground">{formatoValor(o, o.actual.valor)}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
