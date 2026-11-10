"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { cn } from "@/lib/utils";
import { EtapasProyecto } from "./EtapasProyecto";
import { HistorialProyecto } from "./HistorialProyecto";
import {
  COLOR_ESTADO_PROYECTO,
  NOMBRE_ESTADO_PROYECTO,
  fechaCortaAR,
  useAccionesProyecto,
  useProyecto,
  type EstadoProyecto,
} from "./use-proyectos";

export function ProyectoFicha({ id }: { id: string }) {
  const { data: p, isPending, isError, error, refetch } = useProyecto(id);
  const { cambiarEstado } = useAccionesProyecto();
  const [pidiendoCancelacion, setPidiendoCancelacion] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const todasCerradas = p.avance.cerradas === p.avance.total && p.avance.total > 0;

  const ejecutarEstado = (estado: EstadoProyecto, motivo?: string) => {
    cambiarEstado.mutate(
      { id: p.id, estado, motivo },
      {
        onSuccess: () => {
          toast.success("Estado del proyecto actualizado");
          setPidiendoCancelacion(false);
          setMotivoCancelacion("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/proyectos"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden /> Proyectos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span>
            <h1 className="text-xl font-semibold">{p.nombre}</h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                COLOR_ESTADO_PROYECTO[p.estado],
              )}
            >
              {NOMBRE_ESTADO_PROYECTO[p.estado]}
            </span>
            {p.atrasado && (
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                🔴 Atrasado {p.diasAtraso > 0 ? `${p.diasAtraso} d` : ""}
              </span>
            )}
            {p.esperandoCliente && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                🟡 Esperando al cliente · {p.diasEsperandoCliente} d
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {p.clienteNombre ? `Cliente: ${p.clienteNombre} · ` : ""}
            {p.responsableNombre ? `Responsable: ${p.responsableNombre} · ` : ""}
            Inicio: {fechaCortaAR(p.fechaInicio)}
            {p.fechaComprometida ? ` · Comprometido: ${fechaCortaAR(p.fechaComprometida)}` : ""}
            {` · Avance: ${p.avance.cerradas}/${p.avance.total} (${p.avance.porcentaje}%)`}
          </p>
          {p.descripcion && <p className="text-sm text-muted-foreground">{p.descripcion}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {p.estado === "activo" && todasCerradas && (
            <Button size="sm" onClick={() => ejecutarEstado("terminado")} disabled={cambiarEstado.isPending}>
              Terminar proyecto
            </Button>
          )}
          {p.estado === "activo" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => ejecutarEstado("pausado")}
              disabled={cambiarEstado.isPending}
            >
              Pausar
            </Button>
          )}
          {p.estado === "pausado" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => ejecutarEstado("activo")}
              disabled={cambiarEstado.isPending}
            >
              Reanudar
            </Button>
          )}
          {(p.estado === "activo" || p.estado === "pausado") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setPidiendoCancelacion((v) => !v)}
            >
              Cancelar proyecto
            </Button>
          )}
        </div>
      </div>

      {pidiendoCancelacion && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
          <Input
            className="h-8 flex-1 text-xs"
            placeholder="Motivo de cancelación…"
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={!motivoCancelacion.trim() || cambiarEstado.isPending}
            onClick={() => ejecutarEstado("cancelado", motivoCancelacion)}
          >
            Confirmar cancelación
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPidiendoCancelacion(false)}>
            Cerrar
          </Button>
        </div>
      )}

      <EtapasProyecto proyecto={p} />
      <HistorialProyecto eventos={p.eventos} />

      <div>
        <Link href="/proyectos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="size-4" aria-hidden /> Volver a proyectos
        </Link>
      </div>
    </div>
  );
}
