"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo } from "@/components/shared/selector-periodo";
import { formatoPesos } from "@/lib/formato";
import { etiquetaFecha, fechasDe, type Rango } from "@/lib/periodos";
import { useInsights } from "../hooks/use-analytics";
import { InsightsMercado } from "./InsightsMercado";

const GRAFICO_SALUD = { valor: { label: "Puntaje", color: "var(--chart-1)" } } satisfies ChartConfig;
const GRAFICO_PRONOSTICO = {
  historico: { label: "Real", color: "var(--chart-1)" },
  proyeccion: { label: "Proyección", color: "var(--chart-3)" },
} satisfies ChartConfig;

const BADGE: Record<string, { etiqueta: string; clase: string }> = {
  inelastica: { etiqueta: "Poco sensible al precio", clase: "bg-emerald-500/15 text-emerald-600" },
  moderada: { etiqueta: "Sensibilidad moderada", clase: "bg-amber-500/15 text-amber-600" },
  elastica: { etiqueta: "Muy sensible al precio", clase: "bg-red-500/15 text-red-600" },
  otros_factores: { etiqueta: "Otros factores", clase: "bg-muted text-muted-foreground" },
};
const TENDENCIA = { positiva: "📈 en alza", negativa: "📉 en baja", neutra: "➡️ estable" } as const;

export function InsightsVista() {
  const [rango, setRango] = useState<Rango>("90dias");
  const { desde, hasta } = fechasDe(rango);
  const { data, isPending, isError, error, refetch } = useInsights(desde, hasta);

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo valor={rango} onCambiar={setRango} />
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

            <Card>
              <CardHeader>
                <CardTitle>Pronóstico de ventas {data.forecast ? TENDENCIA[data.forecast.tendencia] : ""}</CardTitle>
                <CardDescription>
                  {data.forecast
                    ? `${data.forecast.etiquetaProyeccion}: ${formatoPesos(data.forecast.totalProyeccion)} (tendencia de las últimas semanas completas)`
                    : (data.errores.forecast ?? "Hacen falta al menos 30 días de ventas para proyectar.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {data.forecast && (
                  <ChartContainer config={GRAFICO_PRONOSTICO} className="aspect-auto h-full w-full">
                    <LineChart data={data.forecast.puntos} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="clave" tickFormatter={etiquetaFecha} tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                      <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoPesos(Number(v))} labelFormatter={(l) => `Semana del ${etiquetaFecha(String(l))}`} />} />
                      <Line dataKey="historico" stroke="var(--color-historico)" strokeWidth={2} dot={false} connectNulls={false} />
                      <Line dataKey="proyeccion" stroke="var(--color-proyeccion)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
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
                        {formatoPesos(e.precioAnterior)} → {formatoPesos(e.precioActual)} · ventas {e.deltaVentasPct > 0 ? "+" : ""}
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
                      {p.producto}: {formatoPesos(p.precioActual)} → <span className="font-medium">{formatoPesos(p.precioSugerido)}</span> (≈ {formatoPesos(p.extraMes)} más de ganancia por mes)
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <InsightsMercado desde={desde} hasta={hasta} variantes={data.variantes} />
        </>
      )}
    </div>
  );
}
