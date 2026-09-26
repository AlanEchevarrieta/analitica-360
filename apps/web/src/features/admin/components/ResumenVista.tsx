"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { etiquetaGranularidad } from "@/lib/periodos";
import { useEmpresasAdmin, useEvolucionAdmin, useMetricasAdmin, NOMBRE_PLAN, type AlertaEmpresa } from "../hooks/use-admin";
import { EtiquetaAlerta, Indicador, Panel, variacion } from "./comunes";

const G_CLIENTES = {
  clientes: { label: "Clientes", color: "var(--chart-2)" },
  clientesActivos: { label: "Usan la app (con ventas)", color: "var(--chart-1)" },
} satisfies ChartConfig;
const G_DINERO = {
  cobrado: { label: "Cobraste", color: "var(--chart-1)" },
  montoVendido: { label: "Vendieron tus clientes", color: "var(--chart-4)" },
} satisfies ChartConfig;
const G_PLANES = { cantidad: { label: "Clientes", color: "var(--chart-2)" } } satisfies ChartConfig;

/** Qué conviene mirar primero: lo que puede hacer perder un cliente o un cobro. */
const PRIORIDAD: AlertaEmpresa[] = ["vencida", "sin_suscripcion", "prueba_termina", "vence_pronto", "ventas_bajan", "sin_actividad"];
const mes = (clave: string) => etiquetaGranularidad(clave, "mes");

export function ResumenVista() {
  const metricas = useMetricasAdmin();
  const evolucion = useEvolucionAdmin();
  const empresas = useEmpresasAdmin();

  if (metricas.isPending || evolucion.isPending || empresas.isPending) return <CargandoFilas filas={8} />;
  if (metricas.isError) return <ErrorDatos error={metricas.error} onReintentar={() => metricas.refetch()} />;
  if (evolucion.isError) return <ErrorDatos error={evolucion.error} onReintentar={() => evolucion.refetch()} />;
  if (empresas.isError) return <ErrorDatos error={empresas.error} onReintentar={() => empresas.refetch()} />;

  const m = metricas.data;
  const ev = evolucion.data;
  const vivas = empresas.data.filter((e) => !e.baja && !e.esDemo);
  const conAlertas = vivas
    .filter((e) => e.alertas.length > 0)
    .sort((a, b) => Math.min(...a.alertas.map((x) => PRIORIDAD.indexOf(x))) - Math.min(...b.alertas.map((x) => PRIORIDAD.indexOf(x))));
  const activos30 = vivas.filter((e) => e.ventas30 > 0).length;
  const vendido30 = vivas.reduce((a, e) => a + e.monto30, 0);
  const vendidoPrevio = vivas.reduce((a, e) => a + e.montoPrevio30, 0);
  const altas = variacion(m.nuevasEsteMes, m.nuevasMesAnterior);
  const volumen = variacion(vendido30, vendidoPrevio);
  const top = [...vivas].sort((a, b) => b.monto30 - a.monto30).slice(0, 5);
  const hayCobros = ev.some((x) => x.cobrado > 0);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Cómo va el negocio</h1>
        <p className="text-sm text-muted-foreground">Sin contar empresas marcadas como DEMO ni dadas de baja.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Indicador etiqueta="Facturación mensual" valor={formatoPesos(m.mrr)} detalle="Planes activos (MRR)" />
        <Indicador etiqueta="Cobrado este mes" valor={formatoPesos(m.pagosEsteMes)} detalle="Pagos confirmados" />
        <Indicador etiqueta="Clientes" valor={formatoNumero(m.totalEmpresas)} detalle={`${m.activas} activos · ${m.enPrueba} en prueba · ${m.vencidas} vencidos`} />
        <Indicador etiqueta="Nuevos este mes" valor={formatoNumero(m.nuevasEsteMes)} detalle={altas ? `${altas.texto} vs mes anterior (${m.nuevasMesAnterior})` : `Mes anterior: ${m.nuevasMesAnterior}`} tono={altas?.tono} />
        <Indicador etiqueta="Usan la app" valor={`${activos30} de ${vivas.length}`} detalle="Vendieron en los últimos 30 días" tono={activos30 < vivas.length ? "mal" : "bien"} />
        <Indicador etiqueta="Vendieron con la app" valor={formatoPesos(vendido30)} detalle={volumen ? `${volumen.texto} vs 30 días anteriores` : "Últimos 30 días"} tono={volumen?.tono} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Para mirar hoy" descripcion="Clientes con algo que atender" className="lg:col-span-1">
          {conAlertas.length === 0 ? (
            <SinDatos mensaje="Todo en orden: ningún cliente con alertas." />
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {conAlertas.slice(0, 8).map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-2">
                  <Link href={`/admin/clientes/${e.id}`} className="font-medium hover:underline">
                    {e.nombre}
                  </Link>
                  <span className="flex flex-wrap gap-1">
                    {e.alertas.map((a) => (
                      <EtiquetaAlerta key={a} alerta={a} />
                    ))}
                    {e.diasSinVender != null && e.alertas.includes("sin_actividad") && (
                      <span className="text-[11px] text-muted-foreground">hace {e.diasSinVender} días sin vender</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel titulo="Clientes mes a mes" descripcion="Total de clientes y cuántos usan la app de verdad (tienen ventas)" className="lg:col-span-2">
          <div className="h-64">
            <ChartContainer config={G_CLIENTES} className="aspect-auto h-full w-full">
              <BarChart data={ev} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickFormatter={mes} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={32} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => mes(String(l))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="clientes" fill="var(--color-clientes)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="clientesActivos" fill="var(--color-clientesActivos)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Altas en 12 meses: {ev.reduce((a, x) => a + x.altas, 0)} · Bajas: {ev.reduce((a, x) => a + x.bajas, 0)}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Plata" descripcion="Lo que cobraste y lo que vendieron tus clientes usando la app" className="lg:col-span-2">
          <div className="h-64">
            <ChartContainer config={G_DINERO} className="aspect-auto h-full w-full">
              <ComposedChart data={ev} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickFormatter={mes} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="c" hide={!hayCobros} tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <YAxis yAxisId="v" orientation="right" tickFormatter={(v: number) => formatoPesos(v)} tickLine={false} axisLine={false} fontSize={12} width={90} />
                <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoPesos(Number(v))} labelFormatter={(l) => mes(String(l))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="c" dataKey="cobrado" fill="var(--color-cobrado)" radius={[3, 3, 0, 0]} />
                <Line yAxisId="v" type="monotone" dataKey="montoVendido" stroke="var(--color-montoVendido)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          </div>
          {!hayCobros && <p className="mt-2 text-xs text-muted-foreground">Todavía no registraste pagos: cuando cobres, cargalos en Pagos y aparecen acá.</p>}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel titulo="Planes" descripcion="Clientes activos o en prueba por plan">
            {m.empresasPorPlan.length === 0 ? (
              <SinDatos mensaje="Sin planes activos." />
            ) : (
              <div className="h-36">
                <ChartContainer config={G_PLANES} className="aspect-auto h-full w-full">
                  <BarChart data={m.empresasPorPlan.map((p) => ({ ...p, nombre: NOMBRE_PLAN(p.plan) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="nombre" tickLine={false} axisLine={false} fontSize={12} width={80} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </Panel>
          <Panel titulo="Los que más venden" descripcion="Últimos 30 días">
            <ol className="flex flex-col gap-1.5 text-sm">
              {top.map((e, i) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                  <Link href={`/admin/clientes/${e.id}`} className="flex-1 truncate hover:underline">
                    {e.nombre}
                  </Link>
                  <span className="font-medium tabular-nums">{formatoPesos(e.monto30)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
