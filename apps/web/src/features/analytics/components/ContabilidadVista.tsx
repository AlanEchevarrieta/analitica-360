"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo } from "@/components/shared/selector-periodo";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { etiquetaFecha, fechasDe, type Rango } from "@/lib/periodos";
import { useContabilidad } from "../hooks/use-analytics";
import { GastosPanel } from "./GastosPanel";
import { Kpi, TOOLTIP_ESTILO } from "./comunes";

const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(1) : "0"}%`;

function Fila({ etiqueta, valor, fuerte, negativo }: { etiqueta: string; valor: number; fuerte?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${fuerte ? "border-t font-semibold" : ""}`}>
      <dt className={fuerte ? "" : "text-muted-foreground"}>{etiqueta}</dt>
      <dd className={`tabular-nums ${valor < 0 ? "text-destructive" : ""}`}>{negativo ? `−${formatoPesos(valor)}` : formatoPesos(valor)}</dd>
    </div>
  );
}

export function ContabilidadVista() {
  const [rango, setRango] = useState<Rango>("mes");
  const { desde, hasta } = fechasDe(rango);
  const { data, isPending, isError, error, refetch } = useContabilidad(desde, hasta);

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo valor={rango} onCambiar={setRango} />
      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Resultado neto" valor={formatoPesos(data.totales.neto)} semaforo={data.semaforoMargenNeto} detalle={`Margen neto ${pct(data.ratios.margenNetoPct)} · Rinde ${pct(data.ratios.roiPct)} sobre costo + gastos`} />
            <Kpi titulo="Margen bruto" valor={pct(data.ratios.margenBrutoPct)} semaforo={data.semaforoMargenBruto} />
            <Kpi titulo="Punto de equilibrio" valor={formatoPesos(data.ratios.puntoEquilibrio)} detalle="Ventas necesarias para cubrir los gastos" />
            <Kpi titulo="Días de inventario" valor={formatoNumero(Math.round(data.ratios.diasInventario))} detalle="Cuánto dura el stock al ritmo actual" />
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
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[...data.serie6, ...data.proyeccion.map((p) => ({ ...p, clave: `${p.clave} (proy.)` }))]} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.15} />
                    <XAxis dataKey="clave" tickFormatter={(c: string) => etiquetaFecha(c.slice(0, 7)) + (c.includes("proy") ? "*" : "")} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                    <Tooltip formatter={(v) => formatoPesos(Number(v))} contentStyle={TOOLTIP_ESTILO} />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ventas" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cogs" name="Costo" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="resultado" name="Resultado" stroke="var(--chart-2)" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi titulo="Stock a costo (invertido)" valor={formatoPesos(data.valorStock.invertido)} />
            <Kpi titulo="Stock a precio de venta" valor={formatoPesos(data.valorStock.valorVenta)} />
            <Kpi titulo="Ganancia potencial del stock" valor={formatoPesos(data.valorStock.gananciaPotencial)} detalle="Si vendieras todo el stock a precio de lista" />
          </div>

          <GastosPanel desde={desde} hasta={hasta} />
        </>
      )}
    </div>
  );
}
