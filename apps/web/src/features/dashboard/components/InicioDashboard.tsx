"use client";

import Link from "next/link";

import { AlertTriangle, Cake } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoMoneda } from "@/lib/formato";
import { useDashboard } from "../hooks/use-dashboard";
import { AvisoMonotributo } from "@/features/analytics/components/MonotributoCard";

const GRAFICO_7_DIAS = { total: { label: "Total", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Los más urgentes (la API los ordena por stock); el resto, en Inventario. */
const MAX_STOCK_BAJO = 10;

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </CardHeader>
    </Card>
  );
}

/** `debajoDeCifras`: lo que va justo debajo de las ventas de hoy, semana y mes (punto de equilibrio y objetivos). */
export function InicioDashboard({ debajoDeCifras }: { debajoDeCifras?: React.ReactNode } = {}) {
  const { data, isPending, isError, error, refetch } = useDashboard();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
        <Skeleton className="col-span-2 h-72 lg:col-span-3" />
        <Skeleton className="col-span-2 h-72 lg:col-span-1" />
      </div>
    );
  }
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <AvisoMonotributo />

      {/* Banner de Acceso a Analítica Copilot con IA */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-900/60 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-bold text-lg shadow-md shadow-emerald-500/20">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-zinc-100">Analítica Copilot (Inteligencia de Negocios)</h4>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  IA en vivo
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Consultá en lenguaje natural tus ventas, rentabilidad real y proyecciones de stock.
              </p>
            </div>
          </div>
          <Link
            href="/analytics/copilot"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:scale-105 active:scale-95"
          >
            <span>Preguntar a la IA</span>
            <span>→</span>
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi
          titulo="Ventas de hoy"
          valor={formatoMoneda(data.hoy.total)}
          detalle={`${data.hoy.cantidad} ${data.hoy.cantidad === 1 ? "venta" : "ventas"}`}
        />
        <Kpi titulo="Esta semana" valor={formatoMoneda(data.semana)} />
        <Kpi titulo="Este mes" valor={formatoMoneda(data.mes)} />
        <Kpi titulo="Compras del mes" valor={formatoMoneda(data.comprasMes)} />
      </div>

      {debajoDeCifras}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos 7 días</CardTitle>
            <CardDescription>Total vendido por día</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ChartContainer config={GRAFICO_7_DIAS} className="aspect-auto h-full w-full">
              <BarChart data={data.ultimos7} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={70}
                  tickFormatter={(v: number) => formatoMoneda(v)}
                />
                <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoMoneda(Number(v))} />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Más vendidos</CardTitle>
            <CardDescription>Unidades vendidas esta semana</CardDescription>
          </CardHeader>
          <CardContent>
            {data.top5.length === 0 ? (
              <SinDatos mensaje="Todavía no hay ventas esta semana." />
            ) : (
              <ol className="flex flex-col gap-2">
                {data.top5.map((p, i) => (
                  <li key={p.nombre} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                      {p.nombre}
                    </span>
                    <span className="font-medium tabular-nums">{formatoNumero(p.unidades)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" aria-hidden />
              Stock bajo
            </CardTitle>
            <CardDescription>Productos activos en el umbral de alerta o por debajo</CardDescription>
          </CardHeader>
          <CardContent>
            {data.alertasStock.length === 0 ? (
              <SinDatos mensaje="Ningún producto con stock bajo." />
            ) : (
              <>
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {data.alertasStock.slice(0, MAX_STOCK_BAJO).map((p) => (
                  <li key={p.nombre} className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.nombre}</span>
                    <span
                      className={`font-medium tabular-nums ${p.stock <= 0 ? "text-destructive" : "text-amber-500"}`}
                    >
                      {formatoNumero(p.stock)}
                    </span>
                  </li>
                ))}
              </ul>
              {data.alertasStock.length > MAX_STOCK_BAJO && (
                <Link href="/inventario" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                  Ver {data.alertasStock.length - MAX_STOCK_BAJO} más en Inventario →
                </Link>
              )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="size-4" aria-hidden />
              Cumpleaños próximos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.cumples.length === 0 ? (
              <SinDatos mensaje="No hay cumpleaños próximos." />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.cumples.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.nombre}</span>
                    <span className="text-muted-foreground">{c.dias === 0 ? "hoy" : `en ${c.dias} días`}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
