"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { claveGranularidad, diasEntre, etiquetaGranularidad, granularidadPara, type Granularidad } from "@/lib/periodos";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { usePeriodo } from "../hooks/use-analytics";
import { Kpi } from "./comunes";

const GRAFICO_EVOLUCION = {
  total: { label: "Este período", color: "var(--chart-1)" },
  anterior: { label: "Período anterior", color: "var(--muted-foreground)" },
} satisfies ChartConfig;
const GRAFICO_PAGOS = { total: { label: "Total", color: "var(--chart-2)" } } satisfies ChartConfig;
const GRAFICO_DIAS = { total: { label: "Vendido", color: "var(--chart-1)" } } satisfies ChartConfig;
const GRAFICO_VC = {
  ventas: { label: "Ventas", color: "var(--chart-1)" },
  compras: { label: "Compras", color: "var(--chart-3)" },
} satisfies ChartConfig;

const GRANULARIDADES: { valor: Granularidad; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Día" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
  { valor: "anio", etiqueta: "Año" },
];
const NOMBRE_PERIODO: Record<Granularidad, string> = { dia: "día", semana: "semana", mes: "mes", anio: "año" };
/** Lunes primero (la API usa 0 = domingo). */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const NOMBRE_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const etiquetaPago = (v: string) => FORMAS_PAGO.find((f) => f.valor === v)?.etiqueta ?? v;

function Chips({ valor, opciones, onCambiar }: { valor: Granularidad; opciones: Granularidad[]; onCambiar: (g: Granularidad) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Agrupar por">
      {GRANULARIDADES.filter((g) => opciones.includes(g.valor)).map((g) => (
        <Button key={g.valor} size="xs" variant={valor === g.valor ? "secondary" : "ghost"} aria-pressed={valor === g.valor} onClick={() => onCambiar(g.valor)}>
          {g.etiqueta}
        </Button>
      ))}
    </div>
  );
}

export function VentasPeriodo() {
  const periodo = useRangoFechas("mes");
  const { desde, hasta, rango } = periodo;
  const dias = diasEntre(desde, hasta);
  // null = automática según el largo del período (se reinicia al cambiar de período).
  const [elegida, setElegida] = useState<{ rango: string; g: Granularidad } | null>(null);
  const granularidad = elegida && elegida.rango === `${desde}_${hasta}` ? elegida.g : granularidadPara(dias);
  const [gVC, setGVC] = useState<Granularidad | null>(null);
  const granularidadVC = gVC ?? (dias <= 45 ? "semana" : dias <= 1100 ? "mes" : "anio");
  const { data, isPending, isError, error, refetch, isFetching } = usePeriodo(desde, hasta, granularidad);

  const evolucion = useMemo(
    () => (data?.data?.evolucion ?? []).map((p) => ({ ...p, clave: claveGranularidad(p.fecha, granularidad) })),
    [data, granularidad],
  );

  const diasSemana = useMemo(() => {
    const porDia = new Map((data?.data?.diasSemana ?? []).map((d) => [d.dia, d]));
    const filas = ORDEN_DIAS.map((dia) => ({ dia: NOMBRE_DIA[dia].slice(0, 3), nombre: NOMBRE_DIA[dia], total: porDia.get(dia)?.total ?? 0, cantidad: porDia.get(dia)?.cantidad ?? 0 }));
    const max = Math.max(...filas.map((f) => f.total));
    return { filas, mejor: max > 0 ? filas.find((f) => f.total === max) : undefined, max };
  }, [data]);

  const ventasVsCompras = useMemo(() => {
    const mapa = new Map<string, { ventas: number; compras: number }>();
    const sumar = (fecha: string, campo: "ventas" | "compras", monto: number) => {
      const k = claveGranularidad(fecha, granularidadVC);
      const fila = mapa.get(k) ?? { ventas: 0, compras: 0 };
      fila[campo] += monto;
      mapa.set(k, fila);
    };
    for (const v of data?.data?.evolucionDiaria ?? []) sumar(v.fecha, "ventas", v.total);
    for (const c of data?.data?.comprasDiarias ?? []) sumar(c.fecha, "compras", c.total);
    const filas = [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([clave, v]) => ({ clave, ...v }));
    const dif = (f: { ventas: number; compras: number }) => f.ventas - f.compras;
    const mejor = filas.reduce<(typeof filas)[number] | undefined>((m, f) => (!m || dif(f) > dif(m) ? f : m), undefined);
    const peor = filas.reduce<(typeof filas)[number] | undefined>((m, f) => (!m || dif(f) < dif(m) ? f : m), undefined);
    return { filas, mejor, peor };
  }, [data, granularidadVC]);

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo periodo={periodo} />
      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : !data.data ? (
        <SinDatos mensaje={`El período tiene ${formatoNumero(data.avisoLimite ?? 0)} ventas: elegí uno más corto.`} />
      ) : (
        <div className={`flex flex-col gap-4 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Cobrado" valor={formatoPesos(data.data.total)} detalle={data.data.devoluciones.ingreso ? `Neto de devoluciones (${formatoPesos(data.data.devoluciones.ingreso)})` : undefined} />
            <Kpi titulo="Ventas" valor={formatoNumero(data.data.cantidad)} />
            <Kpi titulo="Ticket promedio" valor={formatoPesos(data.data.cantidad ? data.data.total / data.data.cantidad : 0)} />
            <Kpi titulo="Por cobrar (señas)" valor={formatoPesos(data.data.porCobrar)} />
          </div>

          <Card>
            <CardHeader className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Evolución</CardTitle>
                <CardDescription>{rango === "todo" ? "Todas tus ventas registradas" : "Comparado con el período anterior de la misma duración"}</CardDescription>
              </div>
              <Chips
                valor={granularidad}
                opciones={dias > 400 ? ["semana", "mes", "anio"] : ["dia", "semana", "mes", "anio"]}
                onCambiar={(g) => setElegida({ rango: `${desde}_${hasta}`, g })}
              />
            </CardHeader>
            <CardContent className="h-72">
              <ChartContainer config={GRAFICO_EVOLUCION} className="aspect-auto h-full w-full">
                <LineChart data={evolucion} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="clave" tickFormatter={(c: string) => etiquetaGranularidad(c, granularidad)} tickLine={false} axisLine={false} fontSize={12} minTickGap={16} />
                  <YAxis tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        valueFormatter={(v) => formatoPesos(Number(v))}
                        labelFormatter={(l) => `${granularidad === "semana" ? "Semana del " : ""}${etiquetaGranularidad(String(l), granularidad)}`}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={evolucion.length <= 12} />
                  {rango !== "todo" && <Line type="monotone" dataKey="anterior" stroke="var(--color-anterior)" strokeDasharray="4 4" dot={false} />}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>¿Qué días vendés más?</CardTitle>
                <CardDescription>
                  {diasSemana.mejor
                    ? `Tu mejor día es el ${diasSemana.mejor.nombre.toLowerCase()}: ${formatoPesos(diasSemana.mejor.total)} en ${formatoNumero(diasSemana.mejor.cantidad)} ventas.`
                    : "Sin ventas en el período."}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ChartContainer config={GRAFICO_DIAS} className="aspect-auto h-full w-full">
                  <BarChart data={diasSemana.filas} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                    <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoPesos(Number(v))} labelFormatter={(_, p) => String(p?.[0]?.payload?.nombre ?? "")} />} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {diasSemana.filas.map((f) => (
                        <Cell key={f.dia} fill={f.total === diasSemana.max && f.total > 0 ? "var(--chart-2)" : "var(--color-total)"} fillOpacity={f.total === diasSemana.max ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Ventas vs Compras</CardTitle>
                  <CardDescription>Lo ideal es que las ventas superen a las compras.</CardDescription>
                </div>
                <Chips valor={granularidadVC} opciones={["semana", "mes", "anio"]} onCambiar={setGVC} />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {ventasVsCompras.filas.length === 0 ? (
                  <SinDatos mensaje="Sin ventas ni compras en el período." />
                ) : (
                  <>
                    <div className="h-56">
                      <ChartContainer config={GRAFICO_VC} className="aspect-auto h-full w-full">
                        <BarChart data={ventasVsCompras.filas} margin={{ left: 8, right: 8 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="clave" tickFormatter={(c: string) => etiquetaGranularidad(c, granularidadVC)} tickLine={false} axisLine={false} fontSize={12} minTickGap={12} />
                          <YAxis tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                          <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoPesos(Number(v))} labelFormatter={(l) => etiquetaGranularidad(String(l), granularidadVC)} />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="ventas" fill="var(--color-ventas)" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="compras" fill="var(--color-compras)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      {ventasVsCompras.mejor && (
                        <p>
                          📈 Tu mejor {NOMBRE_PERIODO[granularidadVC]} fue {etiquetaGranularidad(ventasVsCompras.mejor.clave, granularidadVC)}:{" "}
                          {ventasVsCompras.mejor.compras > 0
                            ? `vendiste ${(ventasVsCompras.mejor.ventas / ventasVsCompras.mejor.compras).toLocaleString("es-AR", { maximumFractionDigits: 1 })} veces lo que compraste.`
                            : `vendiste ${formatoPesos(ventasVsCompras.mejor.ventas)} sin compras.`}
                        </p>
                      )}
                      {ventasVsCompras.peor && ventasVsCompras.peor.compras > ventasVsCompras.peor.ventas && (
                        <p>
                          ⚠️ En {etiquetaGranularidad(ventasVsCompras.peor.clave, granularidadVC)} compraste más de lo que vendiste (normal si repusiste stock).
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Medios de pago</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ChartContainer config={GRAFICO_PAGOS} className="aspect-auto h-full w-full">
                  <BarChart data={data.data.formasPago.map((f) => ({ ...f, nombre: etiquetaPago(f.nombre) }))} layout="vertical" margin={{ left: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nombre" width={120} tickLine={false} axisLine={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoPesos(Number(v))} />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
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
        </div>
      )}
    </div>
  );
}
