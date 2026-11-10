"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { formatoNumero, formatoMoneda, formatoPesos } from "@/lib/formato";
import { useMoneda } from "@/lib/moneda";
import { etiquetaFecha, hoyAR } from "@/lib/periodos";
import { useContabilidad } from "../hooks/use-analytics";
import { CATEGORIAS_GASTO, GastosPanel } from "./GastosPanel";
import { MonotributoCard } from "./MonotributoCard";
import { Kpi } from "./comunes";

const GRAFICO_MESES = {
  ingresos: { label: "Ventas", color: "var(--chart-1)" },
  cogs: { label: "Costo", color: "var(--chart-3)" },
  gastos: { label: "Gastos", color: "var(--chart-5)" },
  resultado: { label: "Resultado", color: "var(--chart-2)" },
} satisfies ChartConfig;

const UNIDAD_FREC: Record<string, [string, string]> = {
  semanal: ["semana", "semanas"],
  quincenal: ["quincena", "quincenas"],
  mensual: ["mes", "meses"],
};

const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(1) : "0"}%`;

function Fila({ etiqueta, valor, fuerte, negativo }: { etiqueta: string; valor: number; fuerte?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${fuerte ? "border-t font-semibold" : ""}`}>
      <dt className={fuerte ? "" : "text-muted-foreground"}>{etiqueta}</dt>
      <dd className={`tabular-nums ${valor < 0 ? "text-destructive" : ""}`}>{negativo ? `−${formatoMoneda(valor)}` : formatoMoneda(valor)}</dd>
    </div>
  );
}

export function ContabilidadVista() {
  const periodo = useRangoFechas("mes");
  const { desde, hasta } = periodo;
  const moneda = useMoneda();
  const mesActual = hoyAR().slice(0, 7);
  const { data, isPending, isError, error, refetch } = useContabilidad(desde, hasta);

  const datosGrafico = data
    ? [
        ...data.serie6.map((p) => ({
          ...p,
          claveOriginal: p.clave,
          clave: p.clave === mesActual ? `${p.clave} (en curso)` : p.clave,
        })),
        ...data.proyeccion.map((p) => ({
          ...p,
          claveOriginal: p.clave,
          clave: `${p.clave} (proy.)`,
        })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo periodo={periodo} />
      <MonotributoCard />
      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi
              titulo="Resultado neto"
              valor={formatoMoneda(data.totales.neto)}
              semaforo={data.semaforoMargenNeto}
              detalle={`Margen neto ${pct(data.ratios.margenNetoPct)} · Rinde ${pct(data.ratios.roiPct)}`}
            />
            <Kpi titulo="Margen bruto" valor={pct(data.ratios.margenBrutoPct)} semaforo={data.semaforoMargenBruto} />
            <Kpi titulo="Punto de equilibrio" valor={formatoMoneda(data.ratios.puntoEquilibrio)} detalle="Ventas para cubrir gastos" />
            <Kpi titulo="Días de inventario" valor={formatoNumero(Math.round(data.ratios.diasInventario))} detalle="Duración del stock actual" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Estado de resultados</CardTitle>
                <CardDescription>{formatoNumero(data.totales.cantidadVentas)} ventas en el período</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="text-sm">
                  <Fila etiqueta="Ventas (netas de devoluciones)" valor={data.totales.ingresos} />
                  <Fila etiqueta="Costo de la mercadería" valor={data.totales.cogs} negativo />
                  <Fila etiqueta="Ganancia bruta" valor={data.totales.ingresos - data.totales.cogs} fuerte />
                  <Fila etiqueta="Gastos del negocio" valor={data.totales.gastos} negativo />
                  <Fila etiqueta="Resultado neto" valor={data.totales.neto} fuerte />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimos 6 meses y proyección</CardTitle>
                <CardDescription>Ventas, costo y gastos por mes; la línea es el resultado. Los 3 meses finales son proyectados.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="h-72">
                  <ChartContainer config={GRAFICO_MESES} className="aspect-auto h-full w-full">
                    <ComposedChart data={datosGrafico} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="clave"
                        tickFormatter={(c: string) =>
                          etiquetaFecha(c.slice(0, 7)) + (c.includes("proy") ? " (proy.)" : c.includes("en curso") ? " (en curso)" : "")
                        }
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis tickFormatter={(v: number) => formatoMoneda(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const claveOrig = String(payload[0]?.payload?.claveOriginal ?? String(label).slice(0, 7));
                          const recMes = data.recurrentesDetallePorMes?.[claveOrig] ?? [];
                          return (
                            <div className="rounded-lg border bg-background p-2.5 text-xs shadow-md">
                              <div className="mb-1.5 font-medium">
                                {etiquetaFecha(claveOrig)}
                                {String(label).includes("en curso") ? " (en curso)" : String(label).includes("proy") ? " (proy.)" : ""}
                              </div>
                              <div className="flex flex-col gap-1">
                                {payload.map((item) => (
                                  <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">{GRAFICO_MESES[item.dataKey as keyof typeof GRAFICO_MESES]?.label ?? item.name}</span>
                                    <span className="font-medium tabular-nums">{formatoMoneda(Number(item.value ?? 0))}</span>
                                  </div>
                                ))}
                              </div>
                              {recMes.length > 0 && (
                                <div className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
                                  {recMes.map((r) => {
                                    const [sing, plur] = UNIDAD_FREC[r.frecuencia] ?? ["vez", "veces"];
                                    const u = r.veces === 1 ? sing : plur;
                                    const nom = CATEGORIAS_GASTO[r.categoria] ?? r.descripcion;
                                    return (
                                      <div key={r.id}>
                                        {nom}: {r.veces} {u} × {formatoPesos(r.montoOriginal)} = {formatoMoneda(r.total)}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="cogs" fill="var(--color-cogs)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="resultado" stroke="var(--color-resultado)" strokeWidth={2} />
                    </ComposedChart>
                  </ChartContainer>
                </div>
                {moneda === "USD" && (
                  <p className="text-xs text-muted-foreground">
                    Los gastos cargados en pesos se pasan a dólares con el dólar de cada día.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <Kpi titulo="Stock a costo (invertido)" valor={formatoMoneda(data.valorStock.invertido)} />
            <Kpi titulo="Stock a precio de venta" valor={formatoMoneda(data.valorStock.valorVenta)} />
            <Kpi titulo="Ganancia potencial del stock" valor={formatoMoneda(data.valorStock.gananciaPotencial)} detalle="Si vendieras todo el stock a precio de lista" />
          </div>

          <GastosPanel desde={desde} hasta={hasta} />
        </>
      )}
    </div>
  );
}
