"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { useAccionesDevolucion, useAccionesVenta, useDevoluciones, useVenta } from "../hooks/use-venta";
import { FORMAS_PAGO } from "../types/nueva-venta";
import { DevolucionForm } from "./DevolucionForm";

const formaPago = (v: string) => FORMAS_PAGO.find((f) => f.valor === v)?.etiqueta ?? v;
const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Mendoza" });

function CobrarSaldo({ ventaId, saldo }: { ventaId: string; saldo: number }) {
  const { cobrarSaldo } = useAccionesVenta(ventaId);
  const [monto, setMonto] = useState(String(saldo));
  const [forma, setForma] = useState("efectivo");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input className="w-32" inputMode="decimal" aria-label="Monto a cobrar" value={monto} onChange={(e) => setMonto(e.target.value)} />
      <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Forma de pago" value={forma} onChange={(e) => setForma(e.target.value)}>
        {FORMAS_PAGO.map((f) => (
          <option key={f.valor} value={f.valor}>
            {f.etiqueta}
          </option>
        ))}
      </select>
      <Button
        disabled={cobrarSaldo.isPending}
        onClick={() =>
          cobrarSaldo.mutate(
            { monto: aNumero(monto), formaPago: forma, fecha: hoy() },
            { onSuccess: () => toast.success("Saldo cobrado"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cobrar") },
          )
        }
      >
        Cobrar saldo
      </Button>
    </div>
  );
}

export function VentaFichaVista({ id }: { id: string }) {
  const { data: v, isPending, isError, error, refetch } = useVenta(id);
  const { anular } = useAccionesVenta(id);
  const devoluciones = useDevoluciones();
  const accionesDev = useAccionesDevolucion();
  const [devolviendo, setDevolviendo] = useState(false);

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const subtotal = v.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
  const deEstaVenta = (devoluciones.data ?? []).filter((d) => d.ventaId === v.id);
  const hayDevolucionActiva = deEstaVenta.some((d) => d.estado !== "cancelado");

  function onAnular() {
    const motivo = window.prompt(`¿Por qué anulás la venta ${v?.numeroVenta ?? ""}? (vuelve el stock y deja de contar en los totales)`);
    if (!motivo?.trim()) return;
    anular.mutate(motivo.trim(), {
      onSuccess: () => toast.success("Venta anulada"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo anular"),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tabular-nums">Venta {v.numeroVenta}</h1>
        {v.anulada && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600">Anulada</span>}
        <span className="text-sm text-muted-foreground">{formatoFechaHora(v.fecha)}</span>
        <span className="ml-auto text-lg font-semibold tabular-nums">{formatoPesos(v.total)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.items.map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {i.varianteEtiqueta ? `${i.productoNombre} (${i.varianteEtiqueta})` : i.productoNombre}
                      {i.devueltas > 0 && <span className="ml-2 text-xs text-amber-500">{i.devueltas} devuelta(s)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.cantidad}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoPesos(i.precioUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoPesos(i.cantidad * i.precioUnitario)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="mt-3 flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-6"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatoPesos(subtotal)}</dd></div>
              {v.descuento > 0 && <div className="flex gap-6"><dt className="text-muted-foreground">Descuento</dt><dd className="tabular-nums">−{formatoPesos(v.descuento)}</dd></div>}
              {v.coeficienteInteres > 0 && <div className="flex gap-6"><dt className="text-muted-foreground">Interés {v.coeficienteInteres}% · {v.cuotas} cuotas</dt><dd className="tabular-nums">{formatoPesos(v.total - (v.totalSinInteres ?? 0))}</dd></div>}
              <div className="flex gap-6 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatoPesos(v.total)}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Cobro y acciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>Cliente: {v.clienteNombre ?? "—"}</p>
            {v.listaPrecio && <p>Lista de precios: {v.listaPrecio}</p>}
            <p>Pago: {formaPago(v.formaPago)}</p>
            {v.esSenia && <p>Seña: {formatoPesos(v.montoSenia)} · Debe: {formatoPesos(v.saldoPendiente)}</p>}
            {v.notas && <p className="whitespace-pre-line rounded-md bg-muted/50 p-2 text-xs">{v.notas}</p>}
            {!v.anulada && v.saldoPendiente > 0 && <CobrarSaldo ventaId={v.id} saldo={v.saldoPendiente} />}
            {!v.anulada && !devolviendo && (
              <Button variant="outline" onClick={() => setDevolviendo(true)}>
                Devolución o cambio
              </Button>
            )}
            {!v.anulada && (
              <Button variant="ghost" className="text-destructive" onClick={onAnular} disabled={anular.isPending || hayDevolucionActiva}>
                Anular venta
              </Button>
            )}
            {hayDevolucionActiva && !v.anulada && (
              <p className="text-xs text-muted-foreground">Tiene devoluciones o cambios: para anularla primero cancelalos (solo se pueden cancelar los pendientes).</p>
            )}
          </CardContent>
        </Card>
      </div>

      {devolviendo && <DevolucionForm venta={v} onHecho={() => setDevolviendo(false)} />}

      {deEstaVenta.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Devoluciones y cambios</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {deEstaVenta.map((d) => (
              <div key={d.id} className={`flex flex-wrap items-center gap-3 ${d.estado === "cancelado" ? "opacity-50" : ""}`}>
                <span className="font-medium">{d.tipo === "cambio" ? "Cambio" : "Devolución"} #{d.numero}</span>
                <span className="text-muted-foreground">{formatoFechaHora(d.fecha)}</span>
                <span className="flex-1 truncate">{d.productos}</span>
                <span className="text-muted-foreground">{d.estado}</span>
                {d.estado === "pendiente" && (
                  <Button size="sm" variant="ghost" onClick={() => accionesDev.cancelar.mutate(d.id, { onSuccess: () => toast.success("Cancelada: el stock y la plata vuelven como estaban") })}>
                    Cancelar
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
