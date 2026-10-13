"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { InputPlata } from "@/components/shared/input-plata";
import { useClientes } from "@/features/ventas/hooks/use-nueva-venta";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { PlanesAbono } from "./PlanesAbono";
import { COLOR_ESTADO_ABONO, detallePlan, fechaCorta, NOMBRE_ESTADO_ABONO, useAbonos, useAccionesAbonos, usePlanesAbono, type AbonoFicha } from "./use-abonos";

const FILTROS = [
  { valor: "todos", nombre: "Todos" },
  { valor: "vencido", nombre: "Vencidos" },
  { valor: "por_vencer", nombre: "Por vencer" },
  { valor: "con_deuda", nombre: "Con deuda" },
  { valor: "al_dia", nombre: "Al día" },
  { valor: "baja", nombre: "De baja" },
];
const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** Abonos: quién está al día, quién venció y quién debe. Arriba, los que hay que mirar. */
export function AbonosListado() {
  const [vista, setVista] = useState<"abonados" | "planes">("abonados");
  const [filtro, setFiltro] = useState("todos");
  const [nuevo, setNuevo] = useState(false);
  const abonos = useAbonos(filtro);
  const planes = usePlanesAbono();
  const r = abonos.data?.resumen;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Abonos</h1>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(["abonados", "planes"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setVista(v)} className={`rounded-md px-3 py-1 text-sm ${vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {v === "abonados" ? "Abonados" : "Planes"}
              </button>
            ))}
          </div>
          {vista === "abonados" && (
            <Button onClick={() => setNuevo(true)} disabled={!planes.data?.some((p) => p.activo)}>
              <Plus aria-hidden /> Nuevo abono
            </Button>
          )}
        </div>
      </div>

      {vista === "planes" ? (
        <PlanesAbono />
      ) : (
        <>
          {r && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Dato titulo="Abonados activos" valor={String(r.activos)} detalle={r.mensual ? `${formatoPesos(r.mensual)} por mes en mensuales` : undefined} />
              <Dato titulo="Vencidos" valor={String(r.vencidos)} alerta={r.vencidos > 0} onClick={() => setFiltro("vencido")} />
              <Dato titulo="Por vencer o sin sesiones" valor={String(r.porVencer)} onClick={() => setFiltro("por_vencer")} />
              <Dato titulo="Deuda de cuotas" valor={formatoPesos(r.deuda)} alerta={r.deuda > 0} onClick={() => setFiltro("con_deuda")} />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button key={f.valor} type="button" onClick={() => setFiltro(f.valor)} className={`rounded-full border px-3 py-1 text-sm ${filtro === f.valor ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {f.nombre}
              </button>
            ))}
          </div>
          {abonos.isLoading || planes.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !planes.data?.length ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-2 py-6">
                <p className="font-medium">Primero armá tus planes de abono.</p>
                <p className="text-sm text-muted-foreground">Por ejemplo: «Pase libre mensual», «8 clases por mes» o «Paquete de 10 sesiones». Después le das de alta el abono a cada cliente.</p>
                <Button onClick={() => setVista("planes")}>Armar planes</Button>
              </CardContent>
            </Card>
          ) : !abonos.data?.filas.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{filtro === "todos" ? "Todavía no hay abonados. Tocá «Nuevo abono»." : "No hay abonos en este estado."}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {abonos.data.filas.map((a) => (
                <li key={a.id}>
                  <Link href={`/abonos/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.cliente}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.plan} · {formatoPesos(a.precio)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {a.hasta && <p className={a.estado === "vencido" ? "text-red-600" : "text-muted-foreground"}>{a.estado === "vencido" ? "Venció" : "Hasta"} el {fechaCorta(a.hasta)}</p>}
                      {a.sesionesRestantes != null && <p className="text-muted-foreground">{a.sesionesRestantes === 1 ? "Queda 1 sesión" : `Quedan ${a.sesionesRestantes} sesiones`}</p>}
                      {a.deuda > 0 && <p className="text-red-600">Debe {formatoPesos(a.deuda)}</p>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO_ABONO[a.estado]}`}>{NOMBRE_ESTADO_ABONO[a.estado]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={nuevo} onOpenChange={setNuevo}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nuevo abono</SheetTitle>
          </SheetHeader>
          {nuevo && <NuevoAbono onListo={() => setNuevo(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Dato({ titulo, valor, detalle, alerta, onClick }: { titulo: string; valor: string; detalle?: string; alerta?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex flex-col gap-0.5 rounded-xl border bg-card p-3 text-left enabled:hover:bg-muted/50">
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <span className={`text-xl font-semibold ${alerta ? "text-red-600" : ""}`}>{valor}</span>
      {detalle && <span className="text-xs text-muted-foreground">{detalle}</span>}
    </button>
  );
}

/** Alta: cliente (tiene que estar cargado), plan, precio y cobro de la primera cuota. */
function NuevoAbono({ onListo }: { onListo: () => void }) {
  const clientes = useClientes();
  const planes = usePlanesAbono();
  const rol = useRol();
  const { crear } = useAccionesAbonos();
  const activos = (planes.data ?? []).filter((p) => p.activo);
  const [cliente, setCliente] = useState("");
  const [planId, setPlanId] = useState("");
  const [precio, setPrecio] = useState("");
  const [cobrar, setCobrar] = useState(true);
  const [formaPago, setFormaPago] = useState("efectivo");
  const [desde, setDesde] = useState("");
  const [error, setError] = useState<string | null>(null);
  const plan = activos.find((p) => p.id === (planId || activos[0]?.id)) ?? null;
  const elegido = clientes.data?.find((c) => c.nombre.toLowerCase() === cliente.trim().toLowerCase());

  function guardar() {
    if (!elegido) return setError("Elegí un cliente cargado (el abono queda en su ficha y en su cuenta). Si es nuevo, cargalo primero en Clientes.");
    if (!plan) return setError("Elegí el plan.");
    setError(null);
    crear.mutate(
      { clienteId: elegido.id, planId: plan.id, precio: precio.trim() ? aNumero(precio) : null, notas: null, cobro: cobrar ? { formaPago, desde: desde || null } : null },
      { onSuccess: (a: AbonoFicha) => (toast.success(`Abono de ${a.cliente} dado de alta${cobrar ? " y cobrado" : ""}`), onListo()), onError: (e) => setError(e instanceof Error ? e.message : "No se pudo dar de alta") },
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-cliente">Cliente</Label>
        <Input id="ab-cliente" list="ab-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Elegí un cliente" autoComplete="off" />
        <datalist id="ab-clientes">
          {(clientes.data ?? []).map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
        {cliente.trim() && !elegido && (
          <span className="text-xs text-muted-foreground">
            No está cargado. <Link href="/clientes" className="underline">Cargalo en Clientes</Link> y volvé.
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-plan">Plan</Label>
        <select id="ab-plan" className={selectCls} value={plan?.id ?? ""} onChange={(e) => setPlanId(e.target.value)}>
          {activos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {formatoPesos(p.precio)}
            </option>
          ))}
        </select>
        {plan && <span className="text-xs text-muted-foreground">{detallePlan(plan)}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-precio">Precio para este cliente (opcional)</Label>
        <InputPlata id="ab-precio" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={plan ? `El del plan: ${formatoPesos(plan.precio)}` : ""} disabled={rol !== "dueno"} />
        {rol !== "dueno" && <span className="text-xs text-muted-foreground">Un precio especial lo pone el dueño.</span>}
      </div>
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={cobrar} onChange={(e) => setCobrar(e.target.checked)} />
        Cobrar la primera cuota ahora
      </label>
      {cobrar && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ab-forma">Cómo paga</Label>
            <select id="ab-forma" className={selectCls} value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
              {FORMAS_PAGO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
              <option value="cuenta_corriente">A cuenta (queda debiendo)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ab-desde">Desde</Label>
            <Input id="ab-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span className="text-xs text-muted-foreground">Vacío: desde hoy.</span>
          </div>
        </div>
      )}
      {error && <p className="rounded-md bg-destructive/10 p-2 text-destructive">{error}</p>}
      <Button onClick={guardar} disabled={crear.isPending}>
        {crear.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {cobrar ? "Dar de alta y cobrar" : "Dar de alta"}
      </Button>
    </div>
  );
}
