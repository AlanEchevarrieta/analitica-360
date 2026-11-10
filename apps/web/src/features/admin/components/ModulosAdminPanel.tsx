"use client";

import { toast } from "sonner";
import { MODULOS_CATALOGO, calcularModulosEfectivos, type ModuloToggleId } from "@analitica360/shared-types";
import { formatoNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useAccionesAdmin, useModulosUsoAdmin } from "../hooks/use-admin";
import { Panel } from "./comunes";

/** Interruptores de módulos en la ficha de una empresa en la Consola. */
export function ModulosClientePanel({
  empresaId,
  configuracion,
}: {
  empresaId: string;
  configuracion?: { actividades: string[]; modulos: Record<string, boolean>; modulosEfectivos: Record<string, boolean> };
}) {
  const { actualizarModulosEmpresa } = useAccionesAdmin();
  const actividades = configuracion?.actividades ?? ["productos", "produccion"];
  const efectivos: Record<string, boolean> =
    configuracion?.modulosEfectivos ?? calcularModulosEfectivos(actividades, configuracion?.modulos);

  function alternar(id: ModuloToggleId) {
    const proximo = !efectivos[id];
    actualizarModulosEmpresa.mutate(
      { empresaId, modulos: { ...(configuracion?.modulos ?? {}), [id]: proximo } },
      {
        onSuccess: () => toast.success("Módulos del cliente actualizados"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
      },
    );
  }

  return (
    <Panel
      titulo="Módulos habilitados"
      descripcion="Prendé o escondé módulos del menú para acompañar la incorporación de este cliente."
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS_CATALOGO.map((m) => {
          const activo = Boolean(efectivos[m.id]);
          return (
            <button
              key={m.id}
              type="button"
              disabled={actualizarModulosEmpresa.isPending}
              onClick={() => alternar(m.id)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                activo ? "border-primary/40 bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="truncate">{m.nombre}</span>
              <span className={cn("size-2.5 shrink-0 rounded-full", activo ? "bg-emerald-400" : "bg-muted-foreground/30")} />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/** Estadísticas de qué módulos tienen prendidos o apagados los clientes (Consola → Uso). */
export function ModulosUsoPanel() {
  const { data } = useModulosUsoAdmin();
  if (!data || data.modulos.length === 0) return null;
  const total = Math.max(1, data.totalEmpresas);

  return (
    <Panel
      titulo="Módulos prendidos y apagados"
      descripcion={`Sobre ${formatoNumero(data.totalEmpresas)} empresas reales (sin contar DEMO ni bajas).`}
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {data.modulos.map((m) => {
          const pct = Math.round((m.prendidas / total) * 100);
          return (
            <div key={m.id} className="flex flex-col gap-1 rounded-lg border p-2.5 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{m.nombre}</span>
                <span className="tabular-nums text-muted-foreground">
                  <b className="text-foreground">{m.prendidas}</b> ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, pct)}%` }} />
              </div>
              {(m.prendidasManual > 0 || m.apagadasManual > 0) && (
                <span className="text-[11px] text-muted-foreground">
                  {m.prendidasManual > 0 ? `+${m.prendidasManual} prendido a mano` : ""}
                  {m.prendidasManual > 0 && m.apagadasManual > 0 ? " · " : ""}
                  {m.apagadasManual > 0 ? `-${m.apagadasManual} apagado a mano` : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
