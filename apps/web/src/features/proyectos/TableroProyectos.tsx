"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { cn } from "@/lib/utils";
import {
  fechaCortaAR,
  inicialesNombre,
  useTableroProyectos,
  type FiltrosProyectos,
  type ProyectoFila,
} from "./use-proyectos";

function TarjetaProyecto({ p }: { p: ProyectoFila }) {
  return (
    <Link
      href={`/proyectos/${p.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3.5 text-sm shadow-xs transition-colors hover:bg-muted/40",
        p.atrasado && "border-red-500/40 bg-red-500/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-muted-foreground">{p.codigo}</span>
          <p className="font-medium leading-snug">{p.nombre}</p>
          {p.clienteNombre && (
            <p className="truncate text-xs text-muted-foreground">{p.clienteNombre}</p>
          )}
        </div>
        {p.responsableNombre && (
          <span
            title={p.responsableNombre}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
          >
            {inicialesNombre(p.responsableNombre)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {p.atrasado && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-600 dark:text-red-400">
            🔴 Atrasado {p.diasAtraso > 0 ? `${p.diasAtraso} d` : ""}
          </span>
        )}
        {p.esperandoCliente && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
            🟡 Esperando al cliente · {p.diasEsperandoCliente} d
          </span>
        )}
        {p.maxVersion > 1 && (
          <span className="rounded-full border px-2 py-0.5 font-mono text-muted-foreground">
            v{p.maxVersion}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Avance: {p.avance.cerradas}/{p.avance.total}
        </span>
        {p.fechaComprometida && <span>Entrega: {fechaCortaAR(p.fechaComprometida)}</span>}
      </div>
    </Link>
  );
}

/**
 * Tablero por etapa actual: en escritorio son columnas; en el celular pasa a
 * una lista agrupada por etapa con encabezados plegables, sin scroll horizontal.
 */
export function TableroProyectos({ filtros }: { filtros: FiltrosProyectos }) {
  const { data, isPending, isError, error, refetch } = useTableroProyectos(filtros);
  const [plegadas, setPlegadas] = useState<Record<string, boolean>>({});

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (!data || data.columnas.length === 0) {
    return (
      <SinDatos mensaje="No hay proyectos activos con estos filtros. Creá uno desde una plantilla para empezar." />
    );
  }

  const toggle = (nombre: string) =>
    setPlegadas((prev) => ({ ...prev, [nombre]: !prev[nombre] }));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.columnas.map((col) => {
        const cerrada = Boolean(plegadas[col.nombre]);
        return (
          <div key={col.nombre} className="flex flex-col gap-2.5 rounded-xl border bg-muted/20 p-3">
            <button
              type="button"
              onClick={() => toggle(col.nombre)}
              className="flex items-center justify-between gap-2 text-left text-sm font-semibold"
            >
              <span className="flex items-center gap-1.5">
                <span className="md:hidden">
                  {cerrada ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                </span>
                <span>{col.nombre}</span>
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {col.proyectos.length}
              </span>
            </button>
            <div className={cn("flex flex-col gap-2.5", cerrada && "max-md:hidden")}>
              {col.proyectos.map((p) => (
                <TarjetaProyecto key={p.id} p={p} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
