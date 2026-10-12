"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentoAcciones } from "@/features/documentos/DocumentoAcciones";
import { formatoPesos } from "@/lib/formato";
import { ESTADOS_EDITABLES, useAccionesOrdenCompra, useOrdenCompra, type EstadoOc, type OrdenCompraFicha as Ficha } from "../hooks/use-ordenes-compra";
import { EstadoOcChip } from "./OrdenesCompraListado";
import { OrdenCompraForm } from "./OrdenCompraForm";
import { RecepcionOrden } from "./RecepcionOrden";

const dia = (f: string) => new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

function Acciones({ o, onEditar, onRecibir }: { o: Ficha; onEditar: () => void; onRecibir: () => void }) {
  const { estado } = useAccionesOrdenCompra();
  const cambiar = (nuevo: EstadoOc, aviso: string) => estado.mutate({ id: o.id, estado: nuevo }, { onSuccess: () => toast.success(aviso), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cambiar") });
  if (o.estado === "recibida" || o.estado === "cancelada") return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onRecibir}>
        <PackageCheck aria-hidden /> Llegó la mercadería
      </Button>
      {ESTADOS_EDITABLES.includes(o.estado) && (
        <Button variant="outline" onClick={onEditar}>
          Editar
        </Button>
      )}
      {o.estado === "borrador" && (
        <Button variant="outline" disabled={estado.isPending} onClick={() => cambiar("enviada", "Marcada como enviada")}>
          Marcar enviada
        </Button>
      )}
      {o.estado === "enviada" && (
        <Button variant="outline" disabled={estado.isPending} onClick={() => cambiar("confirmada", "El proveedor la confirmó")}>
          El proveedor la confirmó
        </Button>
      )}
      <Button
        variant="ghost"
        className="text-destructive"
        disabled={estado.isPending}
        onClick={() => window.confirm(o.estado === "recibida_parcial" ? "¿Cancelar lo que falta llegar? Lo recibido queda como está." : `¿Cancelar la orden ${o.numeroOc}?`) && cambiar("cancelada", "Orden cancelada")}
      >
        {o.estado === "recibida_parcial" ? "No llega el resto" : "Cancelar orden"}
      </Button>
    </div>
  );
}

/** Ficha de la orden de compra: detalle, mandarla al proveedor, registrar lo que llegó y cambiar el estado. */
export function OrdenCompraFicha({ id }: { id: string }) {
  const { data: o, isPending, isError, error, refetch } = useOrdenCompra(id);
  const [modo, setModo] = useState<"ver" | "editar" | "recibir">("ver");

  if (isPending) return <CargandoFilas />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (modo === "editar") return <OrdenCompraForm inicial={o} onListo={() => setModo("ver")} onCancelar={() => setModo("ver")} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/compras/ordenes" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a órdenes de compra">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold tabular-nums">Orden {o.numeroOc}</h1>
        <EstadoOcChip estado={o.estado} />
      </div>
      <p className="text-sm text-muted-foreground">
        {o.proveedorNombre ?? "Sin proveedor"} · {dia(o.fechaEmision)}
        {o.fechaEntregaEstimada && ` · entrega estimada ${dia(o.fechaEntregaEstimada)}`}
      </p>

      {modo === "recibir" ? <RecepcionOrden orden={o} onListo={() => setModo("ver")} /> : <Acciones o={o} onEditar={() => setModo("editar")} onRecibir={() => setModo("recibir")} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Llegó</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {i.productoNombre}
                      {i.varianteEtiqueta && <span className="text-muted-foreground"> ({i.varianteEtiqueta})</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.cantidadPedida}</TableCell>
                    <TableCell className={`text-right tabular-nums ${i.recibido ? "text-emerald-600 dark:text-emerald-400" : i.cantidadRecibida > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{i.cantidadRecibida}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoPesos(i.precioUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoPesos(i.cantidadPedida * i.precioUnitario)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-right text-lg font-semibold tabular-nums">Total {formatoPesos(o.total)}</p>
            {o.notas && <p className="mt-3 whitespace-pre-line rounded-md bg-muted/50 p-2 text-sm">{o.notas}</p>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Mandarla al proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentoAcciones tipo="orden_compra" id={o.id} nombre={`Orden de compra ${o.numeroOc}`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
