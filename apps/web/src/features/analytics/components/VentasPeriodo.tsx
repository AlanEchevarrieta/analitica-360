"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo } from "@/components/shared/selector-periodo";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { etiquetaFecha, fechasDe, type Rango } from "@/lib/periodos";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { usePeriodo } from "../hooks/use-analytics";
import { Kpi, TOOLTIP_ESTILO } from "./comunes";

const GRANULARIDAD: Record<Rango, "dia" | "semana" | "mes"> = { mes: "dia", mesPasado: "dia", "90dias": "semana", anio: "mes" };
const etiquetaPago = (v: string) => FORMAS_PAGO.find((f) => f.valor === v)?.etiqueta ?? v;

export function VentasPeriodo() {
  const [rango, setRango] = useState<Rango>("mes");
  const { desde, hasta } = fechasDe(rango);
  const { data, isPending, isError, error, refetch } = usePeriodo(desde, hasta, GRANULARIDAD[rango]);

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo valor={rango} onCambiar={setRango} />
      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : !data.data ? (
        <SinDatos mensaje={`El período tiene ${formatoNumero(data.avisoLimite ?? 0)} ventas: elegí uno más corto.`} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Cobrado" valor={formatoPesos(data.data.total)} detalle={data.data.devoluciones.ingreso ? `Neto de devoluciones (${formatoPesos(data.data.devoluciones.ingreso)})` : undefined} />
            <Kpi titulo="Ventas" valor={formatoNumero(data.data.cantidad)} />
            <Kpi titulo="Ticket promedio" valor={formatoPesos(data.data.cantidad ? data.data.total / data.data.cantidad : 0)} />
            <Kpi titulo="Por cobrar (señas)" valor={formatoPesos(data.data.porCobrar)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolución</CardTitle>
              <CardDescription>Comparado con el período anterior de la misma duración</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.data.evolucion} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.15} />
                  <XAxis dataKey="fecha" tickFormatter={etiquetaFecha} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                  <Tooltip formatter={(v) => formatoPesos(Number(v))} labelFormatter={(l) => etiquetaFecha(String(l))} contentStyle={TOOLTIP_ESTILO} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Este período" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="anterior" name="Período anterior" stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Medios de pago</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.data.formasPago.map((f) => ({ ...f, nombre: etiquetaPago(f.nombre) }))} layout="vertical" margin={{ left: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nombre" width={120} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip formatter={(v) => formatoPesos(Number(v))} contentStyle={TOOLTIP_ESTILO} cursor={{ fillOpacity: 0.08 }} />
                    <Bar dataKey="total" name="Total" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Más vendidos</CardTitle>
                <CardDescription>Unidades en el período</CardDescription>
              </CardHeader>
              <CardContent>
                {data.data.top10.length === 0 ? (
                  <SinDatos mensaje="Sin ventas en el período." />
                ) : (
                  <ol className="flex flex-col gap-1.5 text-sm">
                    {data.data.top10.map((p, i) => (
                      <li key={p.nombre} className="flex justify-between gap-2">
                        <span className="truncate">
                          <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
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
        </>
      )}
    </div>
  );
}
