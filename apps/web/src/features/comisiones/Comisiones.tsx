"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InputPlata } from "@/components/shared/input-plata";
import { useRecursos } from "@/features/agenda/use-agenda";
import { useApiFetch } from "@/hooks/use-api";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { hoyAR, moverDias } from "@/lib/periodos";

// Espejo de apps/api modules/comisiones.
interface Profesional {
  id: string;
  nombre: string;
  color: string;
  porcentajes: { servicios: number; productos: number; porSesion: number };
  baseServicios: number;
  baseProductos: number;
  sesiones: number;
  porServicios: number;
  porProductos: number;
  porSesiones: number;
  total: number;
  pagado: number;
  pendiente: number;
  ventas: { id: string; numero: string | null; fecha: string; cliente: string | null; servicios: number; productos: number; comision: number }[];
  pagos: { id: string; desde: string; hasta: string; monto: number; gastoId: string | null; nota: string | null; fecha: string }[];
}

const primeroDelMes = (f: string) => `${f.slice(0, 8)}01`;
const ultimoDelMes = (f: string) => moverDias(primeroDelMes(moverDias(primeroDelMes(f), 32)), -1);
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

function usePeriodo() {
  const hoy = hoyAR();
  const [rango, setRango] = useState({ desde: primeroDelMes(hoy), hasta: hoy });
  const pasado = moverDias(primeroDelMes(hoy), -1);
  return {
    rango,
    setRango,
    atajos: [
      { nombre: "Este mes", desde: primeroDelMes(hoy), hasta: hoy },
      { nombre: "Mes pasado", desde: primeroDelMes(pasado), hasta: ultimoDelMes(pasado) },
      { nombre: "Últimos 15 días", desde: moverDias(hoy, -14), hasta: hoy },
    ],
  };
}

/** Comisiones: el dueño (y el contador) ven a todos y registran los pagos; cada profesional ve lo suyo. */
export function Comisiones() {
  const rol = useRol();
  const todos = rol === "dueno" || rol === "contador";
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const { rango, setRango, atajos } = usePeriodo();
  const q = `desde=${rango.desde}&hasta=${rango.hasta}`;
  const liquidacion = useQuery({
    queryKey: ["comisiones", todos ? "todos" : "mias", rango, orgId],
    queryFn: () => api<{ profesionales: Profesional[] }>(`/comisiones${todos ? "" : "/mias"}?${q}`),
    enabled: Boolean(orgId),
  });
  const refrescar = () => {
    for (const k of ["comisiones", "contabilidad", "gastos", "dashboard"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const lista = liquidacion.data?.profesionales ?? [];
  const total = lista.reduce((s, p) => s + p.pendiente, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{todos ? "Comisiones" : "Mis comisiones"}</h1>
        {todos && lista.length > 0 && <span className="text-sm text-muted-foreground">Pendiente de pagar: {formatoPesos(total)}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {atajos.map((a) => (
          <button
            key={a.nombre}
            type="button"
            onClick={() => setRango({ desde: a.desde, hasta: a.hasta })}
            className={`rounded-full border px-3 py-1 text-sm ${rango.desde === a.desde && rango.hasta === a.hasta ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {a.nombre}
          </button>
        ))}
        <Input type="date" className="w-auto" value={rango.desde} onChange={(e) => e.target.value && setRango({ ...rango, desde: e.target.value })} aria-label="Desde" />
        <span className="text-sm text-muted-foreground">al</span>
        <Input type="date" className="w-auto" value={rango.hasta} onChange={(e) => e.target.value && setRango({ ...rango, hasta: e.target.value })} aria-label="Hasta" />
      </div>

      {liquidacion.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {todos ? (
              <>
                Todavía no hay profesionales. Cargalos con sus porcentajes en{" "}
                <Link href="/agenda/configuracion" className="underline">
                  Agenda → Profesionales y horarios
                </Link>
                .
              </>
            ) : (
              "Tu usuario no está vinculado a ningún profesional de la agenda. Pedile al dueño que lo vincule."
            )}
          </CardContent>
        </Card>
      ) : (
        lista.map((p) => <TarjetaProfesional key={p.id} p={p} rango={rango} puedePagar={rol === "dueno"} onCambio={refrescar} />)
      )}

      {rol === "dueno" && <SinAsignar rango={rango} onCambio={refrescar} />}
    </div>
  );
}

function TarjetaProfesional({ p, rango, puedePagar, onCambio }: { p: Profesional; rango: { desde: string; hasta: string }; puedePagar: boolean; onCambio: () => void }) {
  const api = useApiFetch();
  const [abierta, setAbierta] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [monto, setMonto] = useState("");
  const [gasto, setGasto] = useState(true);
  const pagar = useMutation({
    mutationFn: () => api("/comisiones/pagos", { method: "POST", body: JSON.stringify({ recursoId: p.id, ...rango, monto: aNumero(monto || String(p.pendiente)), registrarGasto: gasto }) }),
    onSuccess: () => (toast.success(`Pago a ${p.nombre} registrado${gasto ? " (también como gasto)" : ""}`), setPagando(false), setMonto(""), onCambio()),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });
  const anular = useMutation({
    mutationFn: (id: string) => api(`/comisiones/pagos/${id}`, { method: "DELETE" }),
    onSuccess: () => (toast.success("Pago anulado"), onCambio()),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo anular"),
  });
  const reglas = [p.porcentajes.servicios ? `${p.porcentajes.servicios}% servicios` : null, p.porcentajes.productos ? `${p.porcentajes.productos}% productos` : null, p.porcentajes.porSesion ? `${formatoPesos(p.porcentajes.porSesion)} por sesión` : null].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: p.color }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{p.nombre}</p>
            <p className="text-xs text-muted-foreground">{reglas || "Sin comisión cargada"}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{formatoPesos(p.total)}</p>
            {p.pagado > 0 && <p className="text-xs text-muted-foreground">pagado {formatoPesos(p.pagado)}</p>}
            {p.pendiente > 0 && p.pagado > 0 && <p className="text-xs font-medium text-amber-600">falta {formatoPesos(p.pendiente)}</p>}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Parte titulo="Servicios" base={p.baseServicios} comision={p.porServicios} />
          <Parte titulo="Productos" base={p.baseProductos} comision={p.porProductos} />
          <Parte titulo="Sesiones de abono" base={null} detalle={`${p.sesiones} atendidas`} comision={p.porSesiones} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAbierta(!abierta)}>
            <ChevronDown className={abierta ? "rotate-180" : ""} aria-hidden /> {p.ventas.length === 1 ? "1 venta" : `${p.ventas.length} ventas`}
          </Button>
          {puedePagar && p.pendiente > 0 && !pagando && (
            <Button size="sm" onClick={() => setPagando(true)}>
              Registrar pago
            </Button>
          )}
        </div>
        {pagando && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Monto</span>
              <InputPlata className="w-40" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={String(p.pendiente)} />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={gasto} onChange={(e) => setGasto(e.target.checked)} />
              Cargarlo también como gasto (sueldos)
            </label>
            <Button size="sm" onClick={() => pagar.mutate()} disabled={pagar.isPending}>
              {pagar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Registrar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPagando(false)}>
              Cancelar
            </Button>
          </div>
        )}
        {abierta && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {p.ventas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 px-3 py-1.5">
                <span className="text-muted-foreground">{new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span>
                <Link href={`/ventas/${v.id}`} className="text-primary underline">
                  {v.numero ?? "Venta"}
                </Link>
                <span className="min-w-0 flex-1 truncate">{v.cliente ?? ""}</span>
                <span className="text-muted-foreground">{formatoPesos(v.servicios + v.productos)}</span>
                <span className="font-medium">{formatoPesos(v.comision)}</span>
              </li>
            ))}
            {p.ventas.length === 0 && <li className="px-3 py-2 text-muted-foreground">Sin ventas en el período.</li>}
          </ul>
        )}
        {p.pagos.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {p.pagos.map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                Pagado {formatoPesos(x.monto)} el {new Date(x.fecha).toLocaleDateString("es-AR")} (del {fechaCorta(x.desde)} al {fechaCorta(x.hasta)}){x.gastoId ? " · cargado como gasto" : ""}
                {puedePagar && (
                  <Button variant="ghost" size="icon-sm" aria-label="Anular pago" onClick={() => window.confirm("¿Anular este pago? Si se cargó como gasto, también se borra.") && anular.mutate(x.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Parte({ titulo, base, detalle, comision }: { titulo: string; base: number | null; detalle?: string; comision: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="font-medium">{formatoPesos(comision)}</p>
      <p className="text-xs text-muted-foreground">{base != null ? `sobre ${formatoPesos(base)}` : detalle}</p>
    </div>
  );
}

/** Ventas con servicios que no tienen a nadie asignado: se asignan para que sumen. */
function SinAsignar({ rango, onCambio }: { rango: { desde: string; hasta: string }; onCambio: () => void }) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const recursos = useRecursos();
  const queryClient = useQueryClient();
  const ventas = useQuery({
    queryKey: ["comisiones", "sin-asignar", rango, orgId],
    queryFn: () => api<{ id: string; numero: string | null; fecha: string; cliente: string | null; total: number }[]>(`/comisiones/sin-asignar?desde=${rango.desde}&hasta=${rango.hasta}`),
    enabled: Boolean(orgId),
  });
  const asignar = useMutation({
    mutationFn: ({ ventaId, profesionalId }: { ventaId: string; profesionalId: string }) => api(`/comisiones/ventas/${ventaId}`, { method: "PUT", body: JSON.stringify({ profesionalId }) }),
    onSuccess: () => (toast.success("Venta asignada"), void queryClient.invalidateQueries({ queryKey: ["comisiones"] }), onCambio()),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo asignar"),
  });
  if (!ventas.data?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas con servicios sin profesional ({ventas.data.length})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">No suman comisión para nadie. Elegí quién atendió (de ahora en más, se elige en «Atendió» al cargar la venta).</p>
        <ul className="flex flex-col divide-y rounded-lg border">
          {ventas.data.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
              <span className="text-muted-foreground">{new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span>
              <Link href={`/ventas/${v.id}`} className="text-primary underline">
                {v.numero ?? "Venta"}
              </Link>
              <span className="min-w-0 flex-1 truncate">{v.cliente ?? ""}</span>
              <span>{formatoPesos(v.total)}</span>
              <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" defaultValue="" disabled={asignar.isPending} onChange={(e) => e.target.value && asignar.mutate({ ventaId: v.id, profesionalId: e.target.value })} aria-label="Quién atendió">
                <option value="">Atendió…</option>
                {(recursos.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
