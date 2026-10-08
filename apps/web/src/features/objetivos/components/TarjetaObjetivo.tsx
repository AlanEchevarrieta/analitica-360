"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Objetivo } from "../hooks/use-objetivos";
import { ACUMULATIVOS, adjetivoPeriodo, alcance, etiquetaPeriodo, formatoValor, nombreTipo, SEMAFORO } from "../objetivos";

/** Avance de un objetivo: valor contra meta, ritmo esperado, proyección e historial. */
export function TarjetaObjetivo({ o, compacta = false, onEditar, onBorrar }: { o: Objetivo; compacta?: boolean; onEditar?: () => void; onBorrar?: () => void }) {
  const a = o.actual;
  const s = SEMAFORO[a.semaforo];
  const acumulativo = ACUMULATIVOS.includes(o.tipo);
  const ancho = Math.min(100, Math.max(0, a.porcentaje ?? 0));
  const menosEsMejor = o.tipo === "dias_despacho";

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {nombreTipo(o.tipo)} <span className="font-normal text-muted-foreground">{adjetivoPeriodo(o.periodo)}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">{alcance(o)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.chip)}>{s.texto}</span>
            {onEditar && (
              <button type="button" onClick={onEditar} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Editar objetivo">
                <Pencil className="size-3.5" />
              </button>
            )}
            {onBorrar && (
              <button type="button" onClick={onBorrar} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-red-500" aria-label="Borrar objetivo">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-2xl font-semibold tabular-nums">{formatoValor(o, a.valor)}</p>
          <p className="text-xs text-muted-foreground">
            {menosEsMejor ? "Máximo" : "Meta"}{a.meta !== o.meta ? " de este período" : ""}: {formatoValor(o, a.meta)}
            {a.porcentaje != null && !menosEsMejor && o.tipo !== "a_tiempo" && <> · {a.porcentaje.toLocaleString("es-AR")} %</>}
          </p>
        </div>

        {acumulativo && (
          <div className="relative h-2.5 rounded-full bg-foreground/10" role="progressbar" aria-valuenow={a.porcentaje ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Avance">
            <div className={cn("h-full rounded-full transition-all", s.barra)} style={{ width: `${ancho}%` }} />
            {a.esperado != null && a.esperado < 100 && (
              <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/60" style={{ left: `${a.esperado}%` }} title={`Para hoy: ${a.esperado} %`} />
            )}
          </div>
        )}

        {!compacta && (
          <p className="text-xs text-muted-foreground">
            {acumulativo && a.proyeccion != null
              ? `A este ritmo cerrás en ${formatoValor(o, a.proyeccion)}${a.esperado != null ? ` (para hoy deberías ir por el ${a.esperado.toLocaleString("es-AR")} %)` : ""}.`
              : a.semaforo === "sin_datos"
                ? o.tipo === "a_tiempo"
                  ? "Todavía no hay pedidos despachados con fecha comprometida."
                  : "Todavía no hay pedidos despachados en este período."
                : `Período del ${a.desde.split("-").reverse().join("/")} al ${a.hasta.split("-").reverse().join("/")}.`}
          </p>
        )}

        {!compacta && o.historial.length > 0 && (
          <div className="flex items-end gap-1.5 border-t pt-3" aria-label="Períodos anteriores">
            {o.historial.map((h) => {
              const alto = h.porcentaje == null ? 4 : Math.min(100, Math.max(6, h.porcentaje));
              return (
                <div key={h.desde} className="flex flex-1 flex-col items-center gap-1" title={`${formatoValor(o, h.valor)} de ${formatoValor(o, h.meta)} (${SEMAFORO[h.semaforo].texto})`}>
                  <div className="flex h-10 w-full items-end">
                    <div className={cn("w-full rounded-sm", SEMAFORO[h.semaforo].barra)} style={{ height: `${alto}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{etiquetaPeriodo(o.periodo, h.desde)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
