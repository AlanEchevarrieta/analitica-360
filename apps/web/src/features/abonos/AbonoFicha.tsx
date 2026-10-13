"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, MessageCircle, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InputPlata } from "@/components/shared/input-plata";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { COLOR_ESTADO_ABONO, fechaCorta, NOMBRE_ESTADO_ABONO, useAbono, useAccionesAbonos, type AbonoFicha as Ficha } from "./use-abonos";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const hoyAR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Mendoza" });

/** Ficha del abono: cobrar la cuota, anotar sesiones, avisar por WhatsApp, historial. */
export function AbonoFicha({ id }: { id: string }) {
  const abono = useAbono(id);
  if (abono.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!abono.data) return <p className="text-sm text-muted-foreground">No encontramos ese abono.</p>;
  return <Contenido a={abono.data} />;
}

function Contenido({ a }: { a: Ficha }) {
  const rol = useRol();
  const { usar, deshacerUso, baja, mensaje, editar } = useAccionesAbonos();
  const [cobrando, setCobrando] = useState(false);
  const [precio, setPrecio] = useState<string | null>(null);
  const hoy = hoyAR();
  const vigente = a.periodos.filter((p) => p.desde <= hoy && hoy <= p.hasta).at(-1);
  const de = (texto: string) => ({ onSuccess: () => toast.success(texto), onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo") });

  function avisar() {
    const ventana = window.open("", "_blank");
    mensaje.mutate(a.id, {
      onSuccess: (r) => {
        if (ventana) ventana.location.href = r.whatsapp;
        if (!r.telefono) toast.info("El cliente no tiene teléfono cargado: elegí el contacto en WhatsApp.");
      },
      onError: (e) => (ventana?.close(), toast.error(e instanceof Error ? e.message : "No se pudo armar el mensaje")),
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-wrap items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO_ABONO[a.estado]}`}>{NOMBRE_ESTADO_ABONO[a.estado]}</span>
              <h1 className="mt-2 text-xl font-semibold">{a.cliente}</h1>
              <p className="text-muted-foreground">
                {a.plan} · {formatoPesos(a.precio)}
              </p>
              {a.telefono && <p className="text-sm text-muted-foreground">Tel. {a.telefono}</p>}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">{a.estado === "vencido" ? "Venció" : "Pagado hasta"}</span>
              <span className={a.estado === "vencido" ? "font-medium text-red-600" : "font-medium"}>{a.hasta ? fechaCorta(a.hasta) : "—"}</span>
              {a.sesionesRestantes != null && (
                <>
                  <span className="text-muted-foreground">Sesiones que le quedan</span>
                  <span className="font-medium">{a.sesionesRestantes}</span>
                </>
              )}
              <span className="text-muted-foreground">Debe</span>
              <span className={a.deuda > 0 ? "font-medium text-red-600" : "font-medium"}>{formatoPesos(a.deuda)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cuotas cobradas</CardTitle>
          </CardHeader>
          <CardContent>
            {a.periodos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no se cobró ninguna cuota.</p>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {[...a.periodos].reverse().map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                    <span className="font-medium">
                      {fechaCorta(p.desde)} al {fechaCorta(p.hasta)}
                    </span>
                    {p.sesiones != null && (
                      <span className="text-muted-foreground">
                        {p.usadas} de {p.sesiones} sesiones
                      </span>
                    )}
                    <span className="ml-auto">{formatoPesos(p.monto)}</span>
                    <Link href={`/ventas/${p.ventaId}`} className="text-primary underline">
                      Venta {p.numeroVenta ?? ""}
                    </Link>
                    {p.saldo > 0 && <span className="text-red-600">debe {formatoPesos(p.saldo)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {a.deuda > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                La deuda se cobra desde la <Link href="/clientes/cuenta-corriente" className="underline">cuenta corriente</Link> del cliente, como cualquier venta a cuenta.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{a.periodos.some((p) => p.sesiones != null) ? "Sesiones usadas" : "Asistencias"}</CardTitle>
          </CardHeader>
          <CardContent>
            {a.usos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay ninguna anotada.</p>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {a.usos.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-1.5">
                    <span>{new Date(u.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
                    {u.turnoId && <span className="text-xs text-muted-foreground">desde la agenda</span>}
                    {u.nota && <span className="text-muted-foreground">· {u.nota}</span>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => window.confirm("¿Deshacer esta sesión? Vuelve a quedar disponible.") && deshacerUso.mutate({ id: a.id, usoId: u.id }, de("Sesión devuelta"))}
                    >
                      <Undo2 aria-hidden /> Deshacer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:h-fit">
        {a.estado !== "baja" && (
          <>
            {cobrando ? (
              <CobrarCuota a={a} onListo={() => setCobrando(false)} />
            ) : (
              <Button size="lg" onClick={() => setCobrando(true)}>
                <Wallet aria-hidden /> {a.periodos.length ? "Cobrar la próxima cuota" : "Cobrar la primera cuota"}
              </Button>
            )}
            {vigente && (
              <Button variant="outline" onClick={() => usar.mutate({ id: a.id }, de(vigente.sesiones != null ? "Sesión anotada" : "Asistencia anotada"))} disabled={usar.isPending || a.sesionesRestantes === 0}>
                <Check aria-hidden /> {vigente.sesiones != null ? "Anotar una sesión de hoy" : "Anotar asistencia de hoy"}
              </Button>
            )}
            <Button variant="outline" onClick={avisar} disabled={mensaje.isPending}>
              <MessageCircle aria-hidden /> Avisarle por WhatsApp
            </Button>
          </>
        )}
        {rol === "dueno" && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-3 text-sm">
              <Label htmlFor="ab-precio-edit">Precio de este abono</Label>
              <div className="flex gap-2">
                <InputPlata id="ab-precio-edit" value={precio ?? String(a.precio)} onChange={(e) => setPrecio(e.target.value)} />
                <Button variant="outline" disabled={precio === null || aNumero(precio) <= 0 || editar.isPending} onClick={() => editar.mutate({ id: a.id, precio: aNumero(precio ?? "0"), notas: a.notas }, { ...de("Precio actualizado"), onSettled: () => setPrecio(null) })}>
                  Guardar
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">Rige desde la próxima cuota.</span>
            </CardContent>
          </Card>
        )}
        <Button
          variant="ghost"
          className={a.estado === "baja" ? "" : "text-destructive"}
          onClick={() => (a.estado === "baja" || window.confirm(`¿Dar de baja el abono de ${a.cliente}? Lo cobrado queda.`)) && baja.mutate({ id: a.id, activo: a.estado === "baja" }, de(a.estado === "baja" ? "Abono reactivado" : "Abono dado de baja"))}
        >
          {a.estado === "baja" ? "Reactivar el abono" : "Dar de baja"}
        </Button>
      </div>
    </div>
  );
}

function CobrarCuota({ a, onListo }: { a: Ficha; onListo: () => void }) {
  const { cobrar } = useAccionesAbonos();
  const [formaPago, setFormaPago] = useState("efectivo");
  const [desde, setDesde] = useState(a.proximoDesde);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 text-sm">
        <p className="font-medium">
          Cuota de {formatoPesos(a.precio)} · {a.plan}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cu-forma">Cómo paga</Label>
          <select id="cu-forma" className={selectCls} value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
            {FORMAS_PAGO.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
            <option value="cuenta_corriente">A cuenta (queda debiendo)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cu-desde">Desde</Label>
          <Input id="cu-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span className="text-xs text-muted-foreground">Sugerido: {a.hasta && a.proximoDesde !== hoyAR() ? "sigue pegado a la cuota anterior" : "desde hoy"}.</span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              cobrar.mutate(
                { id: a.id, formaPago, desde },
                { onSuccess: () => (toast.success(formaPago === "cuenta_corriente" ? "Cuota cargada a cuenta" : "Cuota cobrada"), onListo()), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cobrar") },
              )
            }
            disabled={cobrar.isPending || !desde}
          >
            {cobrar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {formaPago === "cuenta_corriente" ? "Cargar a cuenta" : "Cobrar"}
          </Button>
          <Button variant="ghost" onClick={onListo}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
