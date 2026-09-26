"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NOMBRE_ALERTA, NOMBRE_ESTADO, NOMBRE_PLAN, type AlertaEmpresa } from "../hooks/use-admin";

/** Número grande de tablero, con etiqueta y un detalle opcional (ej. variación). */
export function Indicador({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "bien" | "mal" | "neutro" }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card/80 p-4">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{etiqueta}</span>
      <span className="text-2xl font-semibold tabular-nums">{valor}</span>
      {detalle && (
        <span className={cn("text-xs", tono === "bien" ? "text-emerald-400" : tono === "mal" ? "text-red-400" : "text-muted-foreground")}>{detalle}</span>
      )}
    </div>
  );
}

export function Panel({ titulo, descripcion, accion, children, className }: { titulo: string; descripcion?: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("bg-card/80", className)}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{titulo}</CardTitle>
          {descripcion && <CardDescription>{descripcion}</CardDescription>}
        </div>
        {accion}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EtiquetaAlerta({ alerta }: { alerta: AlertaEmpresa }) {
  const a = NOMBRE_ALERTA[alerta];
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", a.clase)}>{a.texto}</span>;
}

export function EtiquetaPlan({ plan }: { plan: string | null }) {
  return <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap">{NOMBRE_PLAN(plan)}</span>;
}

export function EtiquetaEstado({ estado }: { estado: string | null }) {
  const clase =
    estado === "activa"
      ? "text-emerald-400"
      : estado === "periodo_prueba"
        ? "text-sky-400"
        : estado === "pendiente_pago"
          ? "text-amber-400"
          : "text-red-400";
  return <span className={cn("text-xs font-medium whitespace-nowrap", estado ? clase : "text-muted-foreground")}>{estado ? (NOMBRE_ESTADO[estado] ?? estado) : "Sin plan"}</span>;
}

/** Variación porcentual entre dos montos, lista para mostrar. */
export function variacion(actual: number, previo: number): { texto: string; tono: "bien" | "mal" | "neutro" } | null {
  if (previo <= 0) return actual > 0 ? { texto: "nuevo", tono: "bien" } : null;
  const pct = Math.round(((actual - previo) / previo) * 100);
  return { texto: `${pct > 0 ? "+" : ""}${pct}%`, tono: pct > 5 ? "bien" : pct < -5 ? "mal" : "neutro" };
}
