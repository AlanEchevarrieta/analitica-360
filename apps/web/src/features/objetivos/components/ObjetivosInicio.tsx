"use client";

import Link from "next/link";
import { Target, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAvisosObjetivos, useObjetivos } from "../hooks/use-objetivos";
import { alcance, formatoValor, nombreTipo, SEMAFORO } from "../objetivos";

/** Inicio: lista compacta de los objetivos que peor van (hasta 4) y los avisos en una sola línea. */
export function ObjetivosInicio() {
  const { data } = useObjetivos();
  const avisos = useAvisosObjetivos();
  if (!data || data.length === 0) return null;
  const orden = { mal: 0, justo: 1, bien: 2, sin_datos: 3 };
  const primeros = [...data].sort((a, b) => orden[a.actual.semaforo] - orden[b.actual.semaforo]).slice(0, 4);
  const pendientes = avisos.data ?? [];

  return (
    <Card className="h-full gap-3 py-4">
      <CardContent className="flex h-full flex-col gap-3 px-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="size-4 text-primary" /> Objetivos
          </p>
          <Link prefetch={false} href="/objetivos" className="text-sm text-primary hover:underline">
            Ver todos{data.length > 4 ? ` (${data.length})` : ""}
          </Link>
        </div>

        {pendientes.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs" role="status">
            <TriangleAlert className="size-3.5 shrink-0 text-red-500" aria-hidden />
            <span className="flex-1">
              {pendientes.length === 1 ? "1 objetivo no llega" : `${pendientes.length} objetivos no llegan`} a este ritmo.
            </span>
            <Link prefetch={false} href="/objetivos" className="font-medium text-primary hover:underline">
              Ver
            </Link>
            <button type="button" className="text-muted-foreground hover:text-foreground" disabled={avisos.leido.isPending} onClick={() => pendientes.forEach((a) => avisos.leido.mutate(a.id))}>
              Ocultar
            </button>
          </div>
        )}

        <ul className="flex flex-col gap-2.5">
          {primeros.map((o) => {
            const s = SEMAFORO[o.actual.semaforo];
            const ancho = Math.min(100, Math.max(0, o.actual.porcentaje ?? 0));
            return (
              <li key={o.id}>
                <Link prefetch={false} href="/objetivos" className="flex flex-col gap-1 rounded-md hover:bg-muted/50">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      {nombreTipo(o.tipo)} <span className="text-xs text-muted-foreground">· {alcance(o)}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums">
                      {formatoValor(o, o.actual.valor)} <span className="text-muted-foreground">/ {formatoValor(o, o.actual.meta)}</span>
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-foreground/10">
                    <div className={cn("h-full rounded-full", s.barra)} style={{ width: `${ancho}%` }} />
                    {o.actual.esperado != null && o.actual.esperado < 100 && <span className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-foreground/50" style={{ left: `${o.actual.esperado}%` }} aria-hidden />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
