"use client";

import { useState } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { ArrowLeft, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentoAcciones } from "@/features/documentos/DocumentoAcciones";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { EntregaOrden } from "./EntregaOrden";
import { EstadoOtChip } from "./OrdenesTrabajoListado";
import { OrdenTrabajoForm } from "./OrdenTrabajoForm";
import { ETAPAS, mensajeEtapa, NOMBRE_ESTADO_OT, useAccionesOt, useOrdenTrabajo, type EstadoOt, type OrdenTrabajoFicha as Ficha } from "./use-ordenes-trabajo";

const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo hacer");
const SIGUIENTE: Partial<Record<EstadoOt, EstadoOt>> = { recibido: "en_proceso", en_proceso: "listo" };

function Etapas({ estado }: { estado: EstadoOt }) {
  const actual = ETAPAS.findIndex((e) => e.id === estado);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Etapas">
      {ETAPAS.map((e, n) => (
        <li key={e.id} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", n < actual ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : n === actual ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {n < actual && <Check className="size-3" aria-hidden />}
          {e.nombre}
        </li>
      ))}
    </ol>
  );
}

function telefonoWa(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "").replace(/^0/, "");
  return d.length < 8 ? null : d.length === 10 ? `549${d}` : d;
}

function Acciones({ o, onEditar, onEntregar }: { o: Ficha; onEditar: () => void; onEntregar: () => void }) {
  const { estado, cancelar } = useAccionesOt();
  const { organization } = useOrganization();
  const abierta = o.estado !== "entregado" && o.estado !== "cancelada";
  const sig = SIGUIENTE[o.estado];
  const tel = telefonoWa(o.clienteTelefono);
  return (
    <div className="flex flex-wrap gap-2">
      {sig && (
        <Button disabled={estado.isPending} onClick={() => estado.mutate({ id: o.id, estado: sig }, { onSuccess: () => toast.success(`Pasó a "${NOMBRE_ESTADO_OT[sig]}"`), onError: error })}>
          Pasar a “{NOMBRE_ESTADO_OT[sig]}”
        </Button>
      )}
      {o.estado === "listo" && <Button onClick={onEntregar}>Entregar y cobrar</Button>}
      {tel && (
        <a href={`https://wa.me/${tel}?text=${encodeURIComponent(mensajeEtapa(o, organization?.name ?? ""))}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          <MessageCircle aria-hidden /> Avisar por WhatsApp
        </a>
      )}
      {abierta && (
        <Button variant="outline" onClick={onEditar}>
          Editar
        </Button>
      )}
      {o.estado === "en_proceso" || o.estado === "recibido" ? (
        <Button variant="ghost" onClick={onEntregar}>
          Entregar ya
        </Button>
      ) : null}
      {abierta && (
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={cancelar.isPending}
          onClick={() => {
            const motivo = window.prompt(`¿Por qué se cancela la orden ${o.numero}?${o.senia ? " La seña se registra como devuelta." : ""}`);
            if (motivo?.trim()) cancelar.mutate({ id: o.id, motivo }, { onSuccess: () => toast.success("Orden cancelada"), onError: error });
          }}
        >
          Cancelar orden
        </Button>
      )}
      {o.ventaId && (
        <Link href={`/ventas/${o.ventaId}`} className={buttonVariants({ variant: "outline" })}>
          Ver la venta {o.numeroVenta}
        </Link>
      )}
    </div>
  );
}

/** Ficha de la orden de trabajo: etapas, ítems, seña, comprobante, avisos, entrega e historial. */
export function OrdenTrabajoFicha({ id }: { id: string }) {
  const { data: o, isPending, isError, error: err, refetch } = useOrdenTrabajo(id);
  const [modo, setModo] = useState<"ver" | "editar" | "entregar">("ver");
  if (isPending) return <CargandoFilas />;
  if (isError) return <ErrorDatos error={err} onReintentar={() => refetch()} />;
  if (modo === "editar") return <OrdenTrabajoForm inicial={o} onListo={() => setModo("ver")} onCancelar={() => setModo("ver")} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/ordenes-trabajo" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a órdenes de trabajo">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold tabular-nums">Orden {o.numero}</h1>
        <EstadoOtChip estado={o.estado} />
      </div>
      <p className="text-sm text-muted-foreground">
        {o.cliente?.nombre ?? o.clienteNombre ?? "Sin cliente"} · {o.equipo}
        {o.responsable && ` · atiende ${o.responsable}`}
        {o.fechaPrometida && ` · para el ${o.fechaPrometida.split("-").reverse().join("/")}`}
      </p>
      {o.estado !== "cancelada" && <Etapas estado={o.estado} />}
      {modo === "entregar" ? <EntregaOrden orden={o} onListo={() => setModo("ver")} /> : <Acciones o={o} onEditar={() => setModo("editar")} onEntregar={() => setModo("entregar")} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {(o.problema || o.notasInternas) && (
            <Card>
              <CardContent className="flex flex-col gap-2 pt-4 text-sm">
                {o.problema && <p><span className="text-muted-foreground">Falla o pedido:</span> {o.problema}</p>}
                {o.notasInternas && <p className="rounded-md bg-muted/50 p-2"><span className="text-muted-foreground">Notas internas:</span> {o.notasInternas}</p>}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-4">
              {o.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no se cargó la mano de obra ni los repuestos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {o.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.descripcion}
                          {i.stock != null && i.cantidad > i.stock && o.estado !== "entregado" && <span className="block text-xs text-amber-600">Stock: {i.stock}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{i.cantidad}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatoPesos(i.cantidad * i.precioUnitario)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-3 flex flex-col items-end gap-1 text-sm">
                {o.descuento > 0 && <span className="text-muted-foreground">Descuento -{formatoPesos(o.descuento)}</span>}
                <span className="text-lg font-semibold tabular-nums">Total {formatoPesos(o.total)}</span>
                {o.senia && (
                  <span className="text-muted-foreground">
                    Seña {formatoPesos(o.senia.monto)} ({o.senia.recibo ?? "recibo sin generar"}) · falta {formatoPesos(o.saldo)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {o.historial.map((h, n) => (
                  <li key={n} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {NOMBRE_ESTADO_OT[h.estado]}
                      {h.nota && <span className="text-muted-foreground"> · {h.nota}</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {formatoFechaHora(h.fecha)}
                      {h.usuario && ` · ${h.usuario}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Comprobante para el cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DocumentoAcciones tipo="orden_trabajo" id={o.id} nombre={`Orden ${o.numero}`} emailCliente={o.cliente?.email} />
            {o.senia && (
              <div className="border-t pt-3">
                <span className="text-xs font-medium text-muted-foreground">Recibo de la seña</span>
                <DocumentoAcciones tipo="recibo" id={o.senia.cobroId} nombre="Recibo de seña" conEmail={false} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
