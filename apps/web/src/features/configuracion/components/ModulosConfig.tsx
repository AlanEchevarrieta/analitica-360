"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  GRUPOS_MODULOS,
  MODULOS_CATALOGO,
  aplicarDependenciasModulos,
  calcularModulosEfectivos,
  type ModuloToggleId,
} from "@analitica360/shared-types";
import { Button } from "@/components/ui/button";
import { CandadoPlan } from "@/components/shared/mejorar-plan";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";
import { useGuardarConfiguracion, type Configuracion } from "../hooks/use-configuracion";

/** Configuración → Módulos: interruptores por sección para prender o esconder módulos sin borrar datos. */
export function ModulosConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const plan = usePlan();
  const [cambios, setCambios] = useState<Record<string, boolean>>(config.modulos ?? {});

  const efectivos = calcularModulosEfectivos(config.actividades, cambios);
  const originales = calcularModulosEfectivos(config.actividades, config.modulos ?? {});
  const hayCambios = MODULOS_CATALOGO.some((m) => efectivos[m.id] !== originales[m.id]);

  function alternar(id: ModuloToggleId) {
    const proximo = !efectivos[id];
    const res = aplicarDependenciasModulos(config.actividades, cambios, { [id]: proximo });
    setCambios(res.modulos);
    if (res.prendidosPorDependencia.length > 0) {
      const nombres = res.prendidosPorDependencia
        .map((depId) => MODULOS_CATALOGO.find((m) => m.id === depId)?.nombre ?? depId)
        .join(", ");
      const actualNombre = MODULOS_CATALOGO.find((m) => m.id === id)?.nombre ?? id;
      toast.info(`También se prendió ${nombres} porque ${actualNombre} lo necesita.`);
    }
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground">
        <p>
          Prendé solo lo que usás para tener un menú más limpio.{" "}
          <strong className="text-foreground">Apagar un módulo no borra nada:</strong> se esconde del menú, tus datos quedan intactos y lo podés volver a prender cuando quieras.
        </p>
        <p className="mt-1 text-xs">
          Siempre prendidos: Inicio, Ventas, Productos, Configuración, Planes y Soporte.
        </p>
      </div>

      {GRUPOS_MODULOS.map((grupo) => {
        const items = MODULOS_CATALOGO.filter((m) => m.grupo === grupo);
        return (
          <div key={grupo} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</h3>
            <div className="divide-y rounded-xl border bg-card/50">
              {items.map((m) => {
                const bloqueadoPorPlan = Boolean(m.funcion && !plan.incluye(m.funcion));
                const prendido = !bloqueadoPorPlan && Boolean(efectivos[m.id]);
                const dependeNombres = m.dependeDe
                  ?.map((d) => MODULOS_CATALOGO.find((x) => x.id === d)?.nombre ?? d)
                  .join(", ");
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("font-medium", bloqueadoPorPlan && "text-muted-foreground")}>
                          {m.nombre}
                        </span>
                        {bloqueadoPorPlan && m.funcion && (
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            <CandadoPlan funcion={m.funcion} /> Disponible en {m.funcion === "tienda" ? "E-commerce" : "Pro"}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{m.descripcion}</span>
                      {dependeNombres && (
                        <span className="text-[11px] text-muted-foreground/80">Necesita: {dependeNombres}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prendido}
                      aria-label={`${prendido ? "Apagar" : "Prender"} ${m.nombre}`}
                      disabled={bloqueadoPorPlan}
                      onClick={() => alternar(m.id)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
                        prendido ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
                          prendido ? "translate-x-5" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <Button
          disabled={!hayCambios || guardar.isPending}
          onClick={() =>
            guardar.mutate(
              { modulos: cambios },
              {
                onSuccess: () => toast.success("Módulos guardados: el menú ya se actualizó"),
                onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
              },
            )
          }
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
