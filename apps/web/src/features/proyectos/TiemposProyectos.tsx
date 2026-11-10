"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { useMetricasProyectos } from "./use-proyectos";

/** Pestaña Tiempos: proyectos terminados, entrega a tiempo y cuánto se trabaja vs cuánto se espera al cliente por etapa. */
export function TiemposProyectos() {
  const { data, isPending, isError, error, refetch } = useMetricasProyectos();

  if (isPending) return <CargandoFilas filas={5} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (!data) return <SinDatos mensaje="Todavía no hay métricas para mostrar." />;

  const maxDias = Math.max(
    1,
    ...data.porEtapa.map((e) => e.diasTrabajoPromedio + e.diasEsperaPromedio),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <CardContent className="px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase">Terminados</span>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.terminados}</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase">A tiempo</span>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.aTiempoPorcentaje}%</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 py-3 sm:col-span-1">
          <CardContent className="px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase">Atraso promedio</span>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.atrasoPromedioDias.toLocaleString("es-AR")} d
            </p>
          </CardContent>
        </Card>
      </div>

      {data.etapaMasDemorada && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          La etapa que más demora es <b>«{data.etapaMasDemorada.nombre}»</b>:{" "}
          <b>{data.etapaMasDemorada.diasEsperaPromedio.toLocaleString("es-AR")} días</b> esperando en promedio.
        </div>
      )}

      {data.porEtapa.length === 0 ? (
        <SinDatos mensaje="Cuando termines tus primeros proyectos, acá vas a ver cuánto lleva cada etapa." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempos promedio por etapa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" /> Trabajando
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500" /> Esperando revisión
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {data.porEtapa.map((e) => {
                const pctTrabajo = (e.diasTrabajoPromedio / maxDias) * 100;
                const pctEspera = (e.diasEsperaPromedio / maxDias) * 100;
                return (
                  <li key={e.nombre} className="flex flex-col gap-1.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{e.nombre}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {e.diasTrabajoPromedio.toLocaleString("es-AR")} d trabajo ·{" "}
                        {e.diasEsperaPromedio.toLocaleString("es-AR")} d espera ·{" "}
                        {e.rondasCambiosPromedio.toLocaleString("es-AR")} rondas de cambios
                      </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.max(pctTrabajo > 0 ? 3 : 0, pctTrabajo)}%` }}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${Math.max(pctEspera > 0 ? 3 : 0, pctEspera)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
