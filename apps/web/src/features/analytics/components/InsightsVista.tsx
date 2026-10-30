"use client";

import { useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoMoneda } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { useInsights } from "../hooks/use-analytics";
import { InsightsMercado } from "./InsightsMercado";
import { PronosticoCard } from "./PronosticoCard";

const GRAFICO_SALUD = { valor: { label: "Puntaje", color: "var(--chart-1)" } } satisfies ChartConfig;

const BADGE: Record<string, { etiqueta: string; clase: string }> = {
  inelastica: { etiqueta: "Poco sensible al precio", clase: "bg-emerald-500/15 text-emerald-600" },
  moderada: { etiqueta: "Sensibilidad moderada", clase: "bg-amber-500/15 text-amber-600" },
  elastica: { etiqueta: "Muy sensible al precio", clase: "bg-red-500/15 text-red-600" },
  otros_factores: { etiqueta: "Otros factores", clase: "bg-muted text-muted-foreground" },
};

export function InsightsVista() {
  const [pronostico, setPronostico] = useState<"semana" | "mes">("semana");
  const { data, isPending, isError, error, refetch, isFetching } = useInsights(pronostico);
  const hasta = hoyAR();

  return (
    <div className={`flex flex-col gap-4 ${isFetching && data ? "opacity-80 transition-opacity" : ""}`}>
      <p className="text-sm text-muted-foreground">Los insights se calculan con todo tu historial de ventas.</p>
      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Salud del negocio: {data.salud?.score ?? "—"}/100</CardTitle>
                <CardDescription>{data.salud?.etiqueta ?? data.errores.radar}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.salud && (
                  <div className="h-60">
                    <ChartContainer config={GRAFICO_SALUD} className="aspect-auto h-full w-full">
                      <RadarChart data={data.salud.ejes} outerRadius="75%">
                        <PolarGrid />
                        <PolarAngleAxis dataKey="eje" fontSize={12} />
                        <Radar dataKey="valor" stroke="var(--color-valor)" fill="var(--color-valor)" fillOpacity={0.35} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </RadarChart>
                    </ChartContainer>
                  </div>
                )}
                <ul className="flex flex-col gap-1 text-sm">
                  {(data.salud?.bullets ?? []).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <PronosticoCard forecast={data.forecast} error={data.errores.forecast} pronostico={pronostico} onPronostico={setPronostico} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Precio y ventas</CardTitle>
              <CardDescription>
                Cómo reaccionaron las ventas de cada producto a su último cambio de precio, descontando la temporada (lo que se movió el resto del negocio).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.elasticidades.length === 0 ? (
                <SinDatos mensaje="Todavía no hay datos suficientes: hace falta un cambio de precio con al menos 5 unidades vendidas antes y 2 semanas después." />
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {data.elasticidades.map((e) => (
                    <li key={e.productoId} className="flex flex-wrap items-center gap-3 py-2">
                      <span className="min-w-40 flex-1 font-medium">{e.producto}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatoMoneda(e.precioAnterior)} → {formatoMoneda(e.precioActual)} · ventas {e.deltaVentasPct > 0 ? "+" : ""}
                        {e.deltaVentasPct.toFixed(0)}%
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[e.badge]?.clase ?? ""}`}>{BADGE[e.badge]?.etiqueta ?? e.badge}</span>
                      <span className="w-full text-xs text-muted-foreground">{e.recomendacion}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.precios.length > 0 && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="mb-1 font-medium">Precios sugeridos</p>
                  {data.precios.map((p) => (
                    <p key={p.producto}>
                      {p.producto}: {formatoMoneda(p.precioActual)} → <span className="font-medium">{formatoMoneda(p.precioSugerido)}</span> (≈ {formatoMoneda(p.extraMes)} más de ganancia por mes)
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <InsightsMercado hasta={hasta} variantes={data.variantes} />
        </>
      )}
    </div>
  );
}
