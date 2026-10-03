"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { etiquetaGranularidad, hoyAR } from "@/lib/periodos";
import { NOMBRE_ESTADO, NOMBRE_PLAN, fechaCorta, useAccionesAdmin, useEmpresaAdmin, usePlanesAdmin } from "../hooks/use-admin";
import { EtiquetaAlerta, EtiquetaEstado, EtiquetaPlan, Indicador, Panel, variacion } from "./comunes";
import { OrigenClientePanel } from "./alianzas/OrigenClientePanel";
import { CuotasClientePanel } from "./alianzas/CuotasCliente";

const G_VENTAS = { monto: { label: "Vendido", color: "var(--chart-1)" } } satisfies ChartConfig;
const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const mas = (dias: number) => {
  const d = new Date(`${hoyAR()}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

function Acciones({ id, suscripcionId, estado, esDemo }: { id: string; suscripcionId: string | null; estado: string | null; esDemo: boolean }) {
  const planes = usePlanesAdmin();
  const { asignarPlan, cambiarEstado, marcarDemo } = useAccionesAdmin();
  const [plan, setPlan] = useState("");
  const [vence, setVence] = useState(mas(30));
  const aviso = (texto: string) => ({ onSuccess: () => toast.success(texto), onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel titulo="Acciones" descripcion="Cambios manuales sobre la cuenta de este cliente">
      <div className="flex flex-col gap-5 text-sm">
        <div className="flex flex-col gap-2">
          <span className="font-medium">Poner en un plan</span>
          <div className="flex flex-wrap gap-2">
            <select className={selectClase} aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">Elegí un plan…</option>
              {(planes.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {NOMBRE_PLAN(p.nombre)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2">
              hasta
              <Input type="date" className="w-40" value={vence} onChange={(e) => setVence(e.target.value)} />
            </label>
            <Button size="sm" disabled={!plan || asignarPlan.isPending} onClick={() => asignarPlan.mutate({ empresaId: id, planId: plan, fechaVencimiento: vence }, aviso("Plan asignado"))}>
              Asignar
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Queda activo hasta esa fecha. Sirve para activar un plan pago o regularizar clientes viejos.</span>
        </div>

        {suscripcionId && (
          <div className="flex flex-col gap-2">
            <span className="font-medium">Estado de la suscripción</span>
            <select
              className={selectClase}
              aria-label="Estado de la suscripción"
              value={estado ?? ""}
              onChange={(e) => cambiarEstado.mutate({ suscripcionId, estado: e.target.value }, aviso("Estado actualizado"))}
            >
              {Object.entries(NOMBRE_ESTADO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="font-medium">Registrar un cobro</span>
          <span className="text-xs text-muted-foreground">
            Se carga en <Link href="/admin/pagos" className="text-primary hover:underline">Pagos</Link>: el sistema calcula el monto según el plan, el ciclo y el código del cliente.
          </span>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={esDemo} onChange={(e) => marcarDemo.mutate({ empresaId: id, esDemo: e.target.checked }, aviso(e.target.checked ? "Marcada como DEMO" : "Ya no es DEMO"))} />
          Es una empresa DEMO (propia o de prueba): no suma en las métricas del negocio
        </label>
      </div>
    </Panel>
  );
}

export function ClienteFichaVista({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useEmpresaAdmin(id);
  if (isPending) return <CargandoFilas filas={8} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const e = data.empresa;
  const v = variacion(e.monto30, e.montoPrevio30);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/admin/clientes" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" aria-hidden /> Clientes
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {e.nombre}
            {e.esDemo && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-400">DEMO</span>}
            <EtiquetaPlan plan={e.plan} />
            <EtiquetaEstado estado={e.estado} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Cliente desde {fechaCorta(e.alta)}
            {data.uso.primeraVenta && data.uso.primeraVenta < e.alta ? ` (vende desde ${fechaCorta(data.uso.primeraVenta)})` : ""} · vence {fechaCorta(e.vencimiento)}
            {e.baja ? ` · dado de baja el ${fechaCorta(e.baja)}` : ""}
          </p>
          <span className="flex flex-wrap gap-1">
            {e.alertas.map((a) => (
              <EtiquetaAlerta key={a} alerta={a} />
            ))}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador etiqueta="Vendió (30 días)" valor={formatoPesos(e.monto30)} detalle={v ? `${v.texto} vs 30 días anteriores` : `${formatoNumero(e.ventas30)} ventas`} tono={v?.tono} />
        <Indicador etiqueta="Ventas registradas" valor={formatoNumero(data.uso.ventasTotales)} detalle={e.ultimaVenta ? `Última: ${fechaCorta(e.ultimaVenta)}` : "Todavía no vendió"} />
        <Indicador etiqueta="Uso" valor={`${e.productos} productos`} detalle={`${data.uso.clientes} clientes · ${data.uso.compras} compras · ${data.uso.pedidos} pedidos`} />
        <Indicador etiqueta="Usuarios" valor={formatoNumero(e.usuarios)} />
        <Indicador etiqueta="Te pagó en total" valor={formatoPesos(e.pagadoTotal)} detalle={e.ultimoPago ? `Último pago: ${fechaCorta(e.ultimoPago)}` : "Sin pagos registrados"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Ventas por mes" descripcion="Lo que vendió con la app en los últimos 12 meses">
          <div className="h-56">
            <ChartContainer config={G_VENTAS} className="aspect-auto h-full w-full">
              <BarChart data={data.ventasPorMes} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickFormatter={(m: string) => etiquetaGranularidad(m, "mes")} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(x: number) => formatoPesos(x)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <ChartTooltip content={<ChartTooltipContent valueFormatter={(x) => formatoPesos(Number(x))} labelFormatter={(l) => etiquetaGranularidad(String(l), "mes")} />} />
                <Bar dataKey="monto" fill="var(--color-monto)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </Panel>
        <Acciones id={e.id} suscripcionId={e.suscripcionId} estado={e.estado} esDemo={e.esDemo} />
      </div>

      <OrigenClientePanel empresaId={id} />

      <CuotasClientePanel empresaId={id} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Usuarios">
          <ul className="flex flex-col divide-y text-sm">
            {data.usuarios.map((u) => (
              <li key={u.email} className="py-2">
                <span className="font-medium">{u.nombre || u.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {u.email} · {u.rol === "dueno" ? "dueño" : u.rol} · desde {fechaCorta(u.alta)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel titulo="Pagos">
          {data.pagos.length === 0 ? (
            <SinDatos mensaje="Sin pagos registrados." />
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {data.pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {p.periodo ?? fechaCorta(p.fecha)} <span className="text-xs text-muted-foreground">· {p.metodo}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatoPesos(p.montoArs)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel titulo="Soporte y cambios de plan">
          <ul className="flex flex-col divide-y text-sm">
            {data.tickets.map((t) => (
              <li key={t.id} className="py-2">
                <Link prefetch={false} href={`/admin/soporte/${t.id}`} className="font-medium hover:underline">
                  {t.numeroTicket} · {t.asunto}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {fechaCorta(t.fecha)} · {t.estado.replace("_", " ")}
                </span>
              </li>
            ))}
            {data.historialPlanes.map((h, i) => (
              <li key={`h${i}`} className="py-2 text-xs text-muted-foreground">
                {fechaCorta(h.fecha)} · plan {NOMBRE_PLAN(h.planAnterior)} → {NOMBRE_PLAN(h.planNuevo)}
                {h.motivo ? ` (${h.motivo})` : ""}
              </li>
            ))}
            {data.tickets.length === 0 && data.historialPlanes.length === 0 && <li className="py-2 text-muted-foreground">Sin tickets ni cambios de plan.</li>}
          </ul>
        </Panel>
      </div>
      <Link href="/admin/clientes" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
        <ArrowLeft aria-hidden /> Volver a clientes
      </Link>
    </>
  );
}
