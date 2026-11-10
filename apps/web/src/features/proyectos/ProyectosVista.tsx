"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListaProyectos } from "./ListaProyectos";
import { TableroProyectos } from "./TableroProyectos";
import { TiemposProyectos } from "./TiemposProyectos";
import { useResponsablesProyecto, type FiltrosProyectos } from "./use-proyectos";

type VistaTab = "tablero" | "lista" | "tiempos";

export function ProyectosVista() {
  const [vista, setVista] = useState<VistaTab>("tablero");
  const [filtros, setFiltros] = useState<FiltrosProyectos>({
    estado: "activos",
    responsableId: "",
    atrasados: false,
  });
  const responsables = useResponsablesProyecto();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Etapas, responsables, aprobaciones del cliente y seguimiento de plazos.
          </p>
        </div>
        <Link href="/proyectos/nuevo" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden /> Nuevo proyecto
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border p-1" role="tablist" aria-label="Vista de proyectos">
          {(
            [
              ["tablero", "Tablero"],
              ["lista", "Lista"],
              ["tiempos", "Tiempos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vista === id}
              onClick={() => setVista(id)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                vista === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {vista !== "tiempos" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {vista === "lista" && (
              <select
                className="h-8 rounded-lg border bg-transparent px-2 text-xs"
                aria-label="Estado del proyecto"
                value={filtros.estado ?? "activos"}
                onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="activos">Activos</option>
                <option value="terminados">Terminados</option>
                <option value="todos">Todos</option>
              </select>
            )}
            <select
              className="h-8 rounded-lg border bg-transparent px-2 text-xs"
              aria-label="Responsable"
              value={filtros.responsableId ?? ""}
              onChange={(e) => setFiltros((f) => ({ ...f, responsableId: e.target.value }))}
            >
              <option value="">Todos los responsables</option>
              {(responsables.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(filtros.atrasados)}
                onChange={(e) => setFiltros((f) => ({ ...f, atrasados: e.target.checked }))}
              />
              Solo atrasados
            </label>
          </div>
        )}
      </div>

      {vista === "tablero" && <TableroProyectos filtros={filtros} />}
      {vista === "lista" && <ListaProyectos filtros={filtros} />}
      {vista === "tiempos" && <TiemposProyectos />}
    </div>
  );
}
