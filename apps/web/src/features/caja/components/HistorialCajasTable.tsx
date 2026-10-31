"use client";

import { useState } from "react";
import { Clock, Eye, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatoPesos } from "@/lib/formato";
import { useHistorialCajas, useReporteZ } from "../hooks/use-caja";
import { TicketReporteXZ } from "./TicketReporteXZ";
import type { CajaHistorialItem } from "../types/caja.types";

export function HistorialCajasTable() {
  const { data: historial, isPending, isError } = useHistorialCajas();
  const [cajaSeleccionadaId, setCajaSeleccionadaId] = useState<string | null>(null);
  const { data: reporteZ, isPending: cargandoZ } = useReporteZ(cajaSeleccionadaId);

  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground animate-pulse">
        <Loader2 className="size-5 animate-spin mr-2" /> Cargando historial de turnos...
      </div>
    );
  }

  if (isError || !historial) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-xs text-rose-600">
        No se pudo cargar el historial de cajas. Por favor, reintentá.
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center text-muted-foreground">
        <Clock className="size-8 opacity-40 mb-2" />
        <p className="text-sm font-semibold">Sin registros históricos de caja</p>
        <span className="text-xs opacity-75">
          Cuando cierres tu primer turno con arqueo, su Reporte Z quedará guardado acá.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50 font-medium text-muted-foreground uppercase text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Fecha</th>
              <th className="py-2.5 px-3">Caja / Turno</th>
              <th className="py-2.5 px-3">Cajero Apertura</th>
              <th className="py-2.5 px-3">Cajero Cierre</th>
              <th className="py-2.5 px-3 text-right">Efectivo Declarado</th>
              <th className="py-2.5 px-3 text-right">Diferencia</th>
              <th className="py-2.5 px-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {historial.map((c: CajaHistorialItem) => {
              const cerrada = c.estado === "cerrada";
              const dif = c.diferencia ?? 0;

              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                    {new Date(c.fechaApertura).toLocaleDateString("es-AR")}
                  </td>
                  <td className="py-2.5 px-3 font-medium">
                    {c.nombreCaja}
                    {!cerrada && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                        ABIERTA
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{c.usuarioApertura.nombre}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {c.usuarioCierre?.nombre ?? "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    {c.montoDeclarado != null ? formatoPesos(c.montoDeclarado) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {cerrada ? (
                      dif === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Exacta</span>
                      ) : dif > 0 ? (
                        <span className="text-indigo-600 dark:text-indigo-400">
                          +{formatoPesos(dif)} (Sob.)
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          {formatoPesos(dif)} (Falt.)
                        </span>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {cerrada ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCajaSeleccionadaId(c.id)}
                        className="h-7 gap-1 text-[11px]"
                      >
                        <FileText className="size-3.5" /> Ver Z
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">En curso</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal para ver / reimprimir Reporte Z */}
      {cajaSeleccionadaId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-indigo-600" />
                <h3 className="text-sm font-semibold">Reporte Z Histórico</h3>
              </div>
              <button
                type="button"
                onClick={() => setCajaSeleccionadaId(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            {cargandoZ || !reporteZ ? (
              <div className="flex h-48 items-center justify-center text-xs text-muted-foreground animate-pulse">
                <Loader2 className="size-5 animate-spin mr-2" /> Cargando reporte...
              </div>
            ) : (
              <TicketReporteXZ reporte={reporteZ} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
