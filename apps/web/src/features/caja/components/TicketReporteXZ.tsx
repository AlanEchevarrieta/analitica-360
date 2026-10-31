"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatoPesos } from "@/lib/formato";
import type { ResumenReporteXZ } from "../types/caja.types";

interface Props {
  reporte: ResumenReporteXZ;
}

export function TicketReporteXZ({ reporte }: Props) {
  const esZ = reporte.tipoReporte === "Z";

  function imprimir() {
    window.print();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[320px] justify-end print:hidden">
        <Button
          size="sm"
          onClick={imprimir}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Printer className="size-4" /> Imprimir Comandera (80mm)
        </Button>
      </div>

      <div className="ticket-imprimible mx-auto w-full max-w-[320px] rounded-lg border bg-white p-5 font-mono text-xs text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100">
        {/* Cabecera */}
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Analítica 360 · Control de Cajas
          </span>
          <h2 className="text-base font-black tracking-tight uppercase mt-1">
            {reporte.negocio.nombre}
          </h2>
          {reporte.negocio.cuit && (
            <p className="text-[11px] text-muted-foreground">CUIT: {reporte.negocio.cuit}</p>
          )}
          {reporte.negocio.direccion && (
            <p className="text-[11px] text-muted-foreground">{reporte.negocio.direccion}</p>
          )}

          <div className="mt-3 rounded border border-dashed border-slate-400 dark:border-slate-700 px-3 py-1 text-center font-bold">
            <span className="text-sm">
              {esZ ? "REPORTE Z (CIERRE FINAL)" : "REPORTE X (CORTE PARCIAL)"}
            </span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />

        {/* Datos del Turno */}
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Caja:</span>
            <span className="font-semibold">{reporte.nombreCaja}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Apertura:</span>
            <span>{new Date(reporte.fechaApertura).toLocaleString("es-AR")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cajero Apertura:</span>
            <span>{reporte.cajeroApertura.nombre}</span>
          </div>

          {reporte.fechaCierre && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cierre:</span>
              <span>{new Date(reporte.fechaCierre).toLocaleString("es-AR")}</span>
            </div>
          )}
          {reporte.cajeroCierre && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cajero Cierre:</span>
              <span>{reporte.cajeroCierre.nombre}</span>
            </div>
          )}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />

        {/* Ventas por medio de pago */}
        <div className="flex flex-col gap-1.5 text-[11px]">
          <span className="font-bold uppercase tracking-wider text-[10px]">
            Ventas por Medio de Pago
          </span>
          {reporte.ventasPorMedioPago.map((mp, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">
                {mp.etiqueta} ({mp.cantidad}x):
              </span>
              <span className="font-medium tabular-nums">{formatoPesos(mp.total)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1 font-bold">
            <span>TOTAL VENTAS ({reporte.cantidadVentas}):</span>
            <span className="tabular-nums">{formatoPesos(reporte.totalVentas)}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />

        {/* Balance de Efectivo */}
        <div className="flex flex-col gap-1 text-[11px]">
          <span className="font-bold uppercase tracking-wider text-[10px]">
            Flujo de Efectivo en Cajón
          </span>
          <div className="flex justify-between text-muted-foreground">
            <span>(+) Fondo Inicial:</span>
            <span className="tabular-nums">{formatoPesos(reporte.montoInicial)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>(+) Ventas Efectivo:</span>
            <span className="tabular-nums font-medium text-emerald-600">
              +{formatoPesos(reporte.totalVentasEfectivo)}
            </span>
          </div>
          {reporte.totalIngresos > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>(+) Ingresos Extra:</span>
              <span className="tabular-nums font-medium text-emerald-600">
                +{formatoPesos(reporte.totalIngresos)}
              </span>
            </div>
          )}
          {reporte.totalEgresos > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>(-) Retiros / Sangrías:</span>
              <span className="tabular-nums font-medium text-rose-600">
                -{formatoPesos(reporte.totalEgresos)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-bold text-xs">
            <span>(=) EFECTIVO TEÓRICO:</span>
            <span className="tabular-nums">{formatoPesos(reporte.efectivoEsperado)}</span>
          </div>
        </div>

        {/* Sección de Arqueo Ciego (Solo Reporte Z) */}
        {esZ && reporte.montoDeclarado != null && (
          <>
            <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />
            <div className="flex flex-col gap-1 rounded bg-slate-50 dark:bg-slate-900/60 p-2 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-[10px]">
                Arqueo Físico de Caja
              </span>
              <div className="flex justify-between">
                <span>Contado por Cajero:</span>
                <span className="font-semibold tabular-nums">
                  {formatoPesos(reporte.montoDeclarado)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Diferencia de Caja:</span>
                <span
                  className={`tabular-nums ${
                    (reporte.diferencia ?? 0) === 0
                      ? "text-emerald-600"
                      : (reporte.diferencia ?? 0) > 0
                        ? "text-indigo-600"
                        : "text-rose-600"
                  }`}
                >
                  {(reporte.diferencia ?? 0) === 0
                    ? "$ 0.00 (EXACTA)"
                    : (reporte.diferencia ?? 0) > 0
                      ? `+${formatoPesos(reporte.diferencia ?? 0)} (SOBRANTE)`
                      : `${formatoPesos(reporte.diferencia ?? 0)} (FALTANTE)`}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-col items-center text-center gap-1">
          <p className="text-[10px] text-muted-foreground">
            {esZ ? "Cierre de turno verificado e inalterable." : "Corte parcial informativo en vivo."}
          </p>
          <p className="text-[8px] text-muted-foreground/60 uppercase tracking-widest">
            Analítica 360 · analitica360.app
          </p>
        </div>
      </div>
    </div>
  );
}
