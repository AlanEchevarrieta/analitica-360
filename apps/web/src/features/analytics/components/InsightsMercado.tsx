"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SinDatos } from "@/components/shared/estado-datos";
import { etiquetaFecha } from "@/lib/periodos";
import { useCombos, useInflacion } from "../hooks/use-analytics";
import type { Insights } from "../types";

const GRAFICO_INFLACION = {
  inflacion: { label: "Inflación del mes", color: "var(--chart-5)" },
  variacion: { label: "Variación de tus precios", color: "var(--chart-1)" },
} satisfies ChartConfig;

const pct = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

export function InsightsMercado({ desde, hasta, variantes }: { desde: string; hasta: string; variantes: Insights["variantes"] }) {
  const combos = useCombos(desde, hasta);
  // Inflación: siempre desde enero para que el acumulado tenga sentido.
  const inflacion = useInflacion(`${hasta.slice(0, 4)}-01-01`, hasta);
  const r = inflacion.data?.resumen;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tus precios contra la inflación ({hasta.slice(0, 4)})</CardTitle>
          <CardDescription>
            {inflacion.data?.errorInflacion ??
              (r?.inflacionAcumuladaPct != null
                ? `Inflación acumulada ${pct(r.inflacionAcumuladaPct)} · tus precios ${pct(r.variacionPreciosPct)}. ${
                    (r.diferenciaPct ?? 0) < 0 ? "Tus precios van por detrás de la inflación: perdés poder de compra." : "Tus precios le ganan a la inflación."
                  }`
                : "Sin datos suficientes.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {inflacion.data && inflacion.data.puntos.length > 0 && (
            <ChartContainer config={GRAFICO_INFLACION} className="aspect-auto h-full w-full">
              <ComposedChart data={inflacion.data.puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mesKey" tickFormatter={etiquetaFecha} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} fontSize={12} width={48} />
                <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => `${Number(v).toFixed(1)}%`} labelFormatter={(l) => etiquetaFecha(String(l))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="inflacion" fill="var(--color-inflacion)" radius={[3, 3, 0, 0]} />
                <Line dataKey="variacion" stroke="var(--color-variacion)" strokeWidth={2} connectNulls />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Se venden juntos</CardTitle>
            <CardDescription>Ideas de combos: pares que aparecen en la misma venta más de lo esperable (lift &gt; 1).</CardDescription>
          </CardHeader>
          <CardContent>
            {(combos.data ?? []).length === 0 ? (
              <SinDatos mensaje="No hay suficientes ventas con varios productos." />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {combos.data!.map((c) => (
                  <li key={`${c.nombreA}-${c.nombreB}`} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-medium">
                      {c.nombreA} + {c.nombreB}
                    </span>
                    <span className="text-muted-foreground">
                      {c.vecesJuntos} veces · {c.confianzaB.toFixed(0)}% de quienes llevan {c.nombreB} lleva {c.nombreA} · lift {c.lift.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variantes más elegidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {!variantes || !variantes.hayVentas ? (
              <SinDatos mensaje="Sin ventas de productos con variantes en el período." />
            ) : (
              <>
                {variantes.porAtributo.map((a) => (
                  <div key={a.atributo} className="flex flex-col gap-1">
                    <p className="font-medium">{a.atributo}</p>
                    {a.valores.map((v) => (
                      <div key={v.name} className="flex items-center gap-2">
                        <span className="w-24 truncate">{v.name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-[var(--chart-4)]" style={{ width: `${v.pct}%` }} />
                        </div>
                        <span className="w-16 text-right tabular-nums">{v.unidades} u</span>
                      </div>
                    ))}
                  </div>
                ))}
                {variantes.bullets.map((b) => (
                  <p key={b} className="text-muted-foreground">
                    {b}
                  </p>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
