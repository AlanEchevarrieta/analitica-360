"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Coins,
  CreditCard,
  Wallet,
} from "lucide-react";
import { formatoPesos } from "@/lib/formato";
import type { EstadoCajaActiva } from "../types/caja.types";

interface Props {
  caja: NonNullable<EstadoCajaActiva["caja"]>;
  totales: NonNullable<EstadoCajaActiva["totalesEnVivo"]>;
}

export function CajaMetricasResumen({ caja, totales }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Fondo Inicial */}
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Fondo Inicial</span>
          <Coins className="size-4" />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight">
          {formatoPesos(caja.montoInicial)}
        </p>
        <span className="text-[11px] text-muted-foreground">Cambio al abrir turno</span>
      </div>

      {/* 2. Ventas Efectivo */}
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
          <span className="text-xs font-medium">Ventas Efectivo</span>
          <Banknote className="size-4" />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
          +{formatoPesos(totales.ventasEfectivo)}
        </p>
        <span className="text-[11px] text-muted-foreground">Cobrado en mano</span>
      </div>

      {/* 3. Ventas Digitales */}
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
        <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
          <span className="text-xs font-medium">Ventas Digitales</span>
          <CreditCard className="size-4" />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
          {formatoPesos(totales.ventasDigitales)}
        </p>
        <span className="text-[11px] text-muted-foreground">Débito, crédito y QR</span>
      </div>

      {/* 4. Sangrías / Retiros */}
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
          <span className="text-xs font-medium">Retiros / Sangrías</span>
          <ArrowDownRight className="size-4" />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
          -{formatoPesos(totales.totalEgresos)}
        </p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {totales.totalIngresos > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +{formatoPesos(totales.totalIngresos)} extra
            </span>
          )}
          {totales.totalIngresos === 0 && <span>Pagos y extracciones</span>}
        </div>
      </div>

      {/* 5. Efectivo Teórico en Cajón (Destacado) */}
      <div className="relative overflow-hidden rounded-xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-card to-background p-4 text-card-foreground shadow-sm">
        <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Efectivo en Cajón
          </span>
          <Wallet className="size-4" />
        </div>
        <p className="mt-2 text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
          {formatoPesos(totales.efectivoEnCajaEsperado)}
        </p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpRight className="size-3 text-indigo-500" />
          <span>Fondo + Cobrado - Retiros</span>
        </div>
      </div>
    </div>
  );
}
