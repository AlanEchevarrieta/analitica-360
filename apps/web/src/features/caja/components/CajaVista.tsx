"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  History,
  Landmark,
  Lock,
  Plus,
  Printer,
  Receipt,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCajaActiva, useReporteX } from "../hooks/use-caja";
import { CajaEstadoBadge } from "./CajaEstadoBadge";
import { CajaMetricasResumen } from "./CajaMetricasResumen";
import { ModalAbrirCaja } from "./ModalAbrirCaja";
import { ModalMovimientoCaja } from "./ModalMovimientoCaja";
import { ModalArqueoCierre } from "./ModalArqueoCierre";
import { TablaMovimientosCaja } from "./TablaMovimientosCaja";
import { HistorialCajasTable } from "./HistorialCajasTable";
import { TicketReporteXZ } from "./TicketReporteXZ";

export function CajaVista() {
  const { data, isPending } = useCajaActiva();
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [modalCierre, setModalCierre] = useState(false);
  const [verReporteX, setVerReporteX] = useState(false);
  const [tab, setTab] = useState<"actual" | "historial">("actual");

  const caja = data?.caja ?? null;
  const totales = data?.totalesEnVivo ?? null;
  const movimientos = data?.movimientosRecientes ?? [];

  const { data: reporteXData } = useReporteX(verReporteX && caja ? caja.id : null);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Cabecera Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight">Control de Cajas y Turnos</h1>
            <CajaEstadoBadge caja={caja} />
          </div>
          <p className="text-xs text-muted-foreground">
            Apertura de turno, control de sangrías, arqueo ciego de efectivo y reportes fiscales X/Z.
          </p>
        </div>

        {/* Botonera de Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          {!caja ? (
            <Button
              onClick={() => setModalAbrir(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" /> Abrir Turno de Caja
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalMovimiento(true)}
                className="gap-1.5"
              >
                <ArrowDownRight className="size-4 text-rose-500" /> Movimiento / Sangría
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerReporteX(true)}
                className="gap-1.5"
              >
                <Printer className="size-4" /> Reporte X
              </Button>
              <Button
                size="sm"
                onClick={() => setModalCierre(true)}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Lock className="size-4" /> Cerrar Turno (Arqueo)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. Métricas en Vivo del Turno (si hay caja abierta) */}
      {caja && totales && <CajaMetricasResumen caja={caja} totales={totales} />}

      {/* 3. Pestañas de Vista */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab("actual")}
          className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-xs font-semibold transition-all ${
            tab === "actual"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="size-4" /> Turno Actual
        </button>
        <button
          type="button"
          onClick={() => setTab("historial")}
          className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-xs font-semibold transition-all ${
            tab === "historial"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-4" /> Historial de Cierres Z
        </button>
      </div>

      {/* 4. Contenido según pestaña */}
      {tab === "actual" ? (
        caja ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Movimientos del Turno (Sangrías e Ingresos)
              </h2>
              <span className="text-xs text-muted-foreground">
                {movimientos.length} movimiento(s)
              </span>
            </div>
            <TablaMovimientosCaja movimientos={movimientos} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-14 px-4 text-center">
            <div className="rounded-full bg-muted p-4 mb-3">
              <Landmark className="size-8 text-muted-foreground" />
            </div>
            <h2 className="text-base font-semibold">No hay ningún turno de caja abierto</h2>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Para empezar a cobrar en el mostrador con arqueo controlado, abrí el turno ingresando
              el cambio inicial en efectivo.
            </p>
            <Button
              onClick={() => setModalAbrir(true)}
              className="mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" /> Abrir Turno con Fondo Inicial
            </Button>
          </div>
        )
      ) : (
        <HistorialCajasTable />
      )}

      {/* Modales */}
      <ModalAbrirCaja abierto={modalAbrir} onCerrar={() => setModalAbrir(false)} />

      {caja && (
        <>
          <ModalMovimientoCaja
            abierto={modalMovimiento}
            cajaId={caja.id}
            onCerrar={() => setModalMovimiento(false)}
          />
          <ModalArqueoCierre
            abierto={modalCierre}
            cajaId={caja.id}
            onCerrar={() => setModalCierre(false)}
          />
        </>
      )}

      {/* Modal Reporte X */}
      {verReporteX && reporteXData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Printer className="size-5 text-indigo-600" />
                <h3 className="text-sm font-semibold">Reporte X (Corte Parcial en Vivo)</h3>
              </div>
              <button
                type="button"
                onClick={() => setVerReporteX(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <TicketReporteXZ reporte={reporteXData} />
          </div>
        </div>
      )}
    </div>
  );
}
