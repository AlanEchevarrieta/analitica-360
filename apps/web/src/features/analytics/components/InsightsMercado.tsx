"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
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

/** Fuerza de un combo según el lift (cuántas veces más de lo esperable se compran juntos). */
function fuerza(lift: number | null) {
  if (lift == null) return null;
  if (lift > 2) return { etiqueta: "🔥 Muy fuerte", clase: "bg-emerald-500/15 text-emerald-600" };
  if (lift >= 1.5) return { etiqueta: "💪 Fuerte", clase: "bg-primary/15 text-primary" };
  if (lift >= 1) return { etiqueta: "👍 Moderado", clase: "bg-amber-500/15 text-amber-600" };
  return { etiqueta: "Débil", clase: "bg-muted text-muted-foreground" };
}

export function InsightsMercado({ hasta, variantes }: { hasta: string; variantes: Insights["variantes"] }) {
  const [tamano, setTamano] = useState<2 | 3>(2);
  const combos = useCombos(tamano);
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle>Se venden juntos</CardTitle>
              <div className="flex gap-1" role="group" aria-label="Tamaño del combo">
                {([2, 3] as const).map((t) => (
                  <Button key={t} size="xs" variant={tamano === t ? "secondary" : "ghost"} aria-pressed={tamano === t} onClick={() => setTamano(t)}>
                    {t === 2 ? "De a 2" : "De a 3"}
                  </Button>
                ))}
              </div>
            </div>
            <CardDescription>Ideas de combos: productos que aparecen en la misma venta más de lo esperable. La fuerza indica cuánto más.</CardDescription>
          </CardHeader>
          <CardContent>
            {(combos.data ?? []).length === 0 ? (
              <SinDatos mensaje={combos.isPending ? "Buscando combos…" : `No hay suficientes ventas con ${tamano} o más productos.`} />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {combos.data!.map((c) => {
                  const f = fuerza(c.lift);
                  return (
                    <li key={`${c.nombreA}-${c.nombreB}-${c.nombreC ?? ""}`} className="flex flex-col gap-1 py-2">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{[c.nombreA, c.nombreB, c.nombreC].filter(Boolean).join(" + ")}</span>
                        {f && <span className={`rounded px-1.5 py-0.5 text-xs ${f.clase}`}>{f.etiqueta}</span>}
                      </span>
                      <span className="text-muted-foreground">
                        {c.vecesJuntos} veces juntos
                        {c.confianzaB != null ? ` · ${c.confianzaB.toFixed(0)}% de quienes llevan ${c.nombreB} lleva ${c.nombreA}` : ""}
                        {c.lift != null ? ` · ${c.lift.toLocaleString("es-AR", { maximumFractionDigits: 2 })}× lo esperable` : ""}
                      </span>
                    </li>
                  );
                })}
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
