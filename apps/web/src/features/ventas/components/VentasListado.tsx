"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Paginacion } from "@/components/shared/paginacion";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { useVentas, VENTAS_POR_PAGINA } from "../hooks/use-ventas";
import type { FiltrosVentas, VentaFila } from "../types";

const FILTROS_INICIALES: FiltrosVentas = { pagina: 1, desde: "", hasta: "", cliente: "" };

const ETIQUETA_FORMA: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  qr: "Mercado Pago QR",
};

function EstadoVenta({ venta }: { venta: VentaFila }) {
  if (venta.anulada) return <span className="text-destructive">Anulada</span>;
  if (venta.saldoPendiente > 0) {
    return <span className="text-amber-500">Debe {formatoPesos(venta.saldoPendiente)}</span>;
  }
  return <span className="text-muted-foreground">Cobrada</span>;
}

export function VentasListado() {
  const [filtros, setFiltros] = useState<FiltrosVentas>(FILTROS_INICIALES);
  const { data, isPending, isError, error, refetch, isFetching } = useVentas(filtros);

  const cambiar = (cambios: Partial<FiltrosVentas>) => setFiltros((f) => ({ ...f, pagina: 1, ...cambios }));
  const rangoIncompleto = Boolean(filtros.desde) !== Boolean(filtros.hasta);
  const hayFiltros = filtros.desde || filtros.hasta || filtros.cliente;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 basis-[calc(50%-0.75rem)] flex-col gap-1.5 sm:flex-none sm:basis-auto">
            <Label htmlFor="ventas-desde">Desde</Label>
            <Input id="ventas-desde" type="date" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          </div>
          <div className="flex min-w-0 flex-1 basis-[calc(50%-0.75rem)] flex-col gap-1.5 sm:flex-none sm:basis-auto">
            <Label htmlFor="ventas-hasta">Hasta</Label>
            <Input id="ventas-hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="ventas-cliente">Cliente</Label>
            <Input
              id="ventas-cliente"
              placeholder="Buscar por nombre"
              value={filtros.cliente}
              onChange={(e) => cambiar({ cliente: e.target.value })}
            />
          </div>
          {hayFiltros && (
            <Button variant="ghost" onClick={() => setFiltros(FILTROS_INICIALES)}>
              Limpiar
            </Button>
          )}
        </div>
        {rangoIncompleto && <p className="text-xs text-muted-foreground">Elegí las dos fechas para filtrar por rango.</p>}

        {isPending ? (
          <CargandoFilas filas={8} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.items.length === 0 ? (
          <SinDatos mensaje={hayFiltros ? "No hay ventas con esos filtros." : "Todavía no hay ventas."} />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="hidden md:table-cell">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Productos</TableHead>
                  <TableHead className="hidden md:table-cell">Pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((v) => (
                  <TableRow key={v.id} className={v.anulada ? "opacity-60" : undefined}>
                    <TableCell className="tabular-nums">
                      <Link prefetch={false} href={`/ventas/${v.id}`} className="font-medium hover:underline">
                        {v.numeroVenta ?? "Ver"}
                      </Link>
                      {/* En el celular las columnas secundarias van debajo del número. */}
                      <div className="mt-0.5 max-w-[55vw] truncate text-xs text-muted-foreground md:hidden">
                        {formatoFechaHora(v.fecha)}
                        {v.clienteNombre ? ` · ${v.clienteNombre}` : ""}
                      </div>
                      <div className="max-w-[55vw] truncate text-xs text-muted-foreground md:hidden">{v.productos}</div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">{formatoFechaHora(v.fecha)}</TableCell>
                    <TableCell className="hidden md:table-cell">{v.clienteNombre ?? <span className="text-muted-foreground/60">—</span>}</TableCell>
                    <TableCell className="hidden max-w-72 truncate md:table-cell" title={v.productos}>
                      {v.productos}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{ETIQUETA_FORMA[v.formaPago] ?? v.formaPago}</TableCell>
                    <TableCell className="text-right align-top font-medium tabular-nums md:align-middle">
                      {formatoPesos(v.total)}
                      <div className="mt-0.5 text-xs font-normal md:hidden">
                        <EstadoVenta venta={v} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      <EstadoVenta venta={v} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <Paginacion
            pagina={filtros.pagina}
            porPagina={VENTAS_POR_PAGINA}
            total={data.total}
            onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
