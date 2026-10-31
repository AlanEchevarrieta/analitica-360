"use client";

import { CheckCircle2, Clock, Lock } from "lucide-react";
import type { EstadoCajaActiva } from "../types/caja.types";

interface Props {
  caja: EstadoCajaActiva["caja"];
}

export function CajaEstadoBadge({ caja }: Props) {
  if (!caja) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <Lock className="size-3.5" />
        <span>Caja Cerrada (Sin turno activo)</span>
      </div>
    );
  }

  const horaApertura = new Date(caja.fechaApertura).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-semibold">{caja.nombreCaja}</span>
      <span className="opacity-40">·</span>
      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
        <Clock className="size-3" /> Abierta {horaApertura} hs
      </span>
      <span className="opacity-40">·</span>
      <span className="text-muted-foreground">{caja.usuarioApertura.nombre}</span>
    </div>
  );
}
