"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Paginacion } from "@/components/shared/paginacion";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { useProductos } from "../hooks/use-productos";
import type { EstadoProducto, FiltrosProductos, OrdenProductos } from "../types";

const POR_PAGINA = 25;
const ESTADOS: { valor: EstadoProducto; etiqueta: string }[] = [
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
  { valor: "todos", etiqueta: "Todos" },
];
const ORDENES: { valor: OrdenProductos; etiqueta: string }[] = [
  { valor: "demanda", etiqueta: "Más vendidos" },
  { valor: "nombre", etiqueta: "A-Z" },
];

function margen(precio: number | null, costo: number | null) {
  if (!precio || !costo) return null;
  return Math.round(((precio - costo) / precio) * 100);
}

export function ProductosListado() {
  const [filtros, setFiltros] = useState<FiltrosProductos>({
    pagina: 1,
    pageSize: POR_PAGINA,
    busqueda: "",
    estado: "activos",
    orden: "demanda",
  });
  const { data, isPending, isError, error, refetch, isFetching } = useProductos(filtros);
  const cambiar = (cambios: Partial<FiltrosProductos>) => setFiltros((f) => ({ ...f, pagina: 1, ...cambios }));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-sm"
            placeholder="Buscar por nombre o código de barras"
            aria-label="Buscar productos"
            value={filtros.busqueda}
            onChange={(e) => cambiar({ busqueda: e.target.value })}
          />
          <div className="flex gap-1" role="group" aria-label="Estado">
            {ESTADOS.map((e) => (
              <Button
                key={e.valor}
                size="sm"
                variant={filtros.estado === e.valor ? "secondary" : "ghost"}
                aria-pressed={filtros.estado === e.valor}
                onClick={() => cambiar({ estado: e.valor })}
              >
                {e.etiqueta}
              </Button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Ordenar">
            {ORDENES.map((o) => (
              <Button
                key={o.valor}
                size="sm"
                variant={filtros.orden === o.valor ? "secondary" : "ghost"}
                aria-pressed={filtros.orden === o.valor}
                onClick={() => cambiar({ orden: o.valor })}
              >
                {o.etiqueta}
              </Button>
            ))}
          </div>
          {data && (
            <span className="ml-auto text-sm text-muted-foreground">{formatoNumero(data.activos)} productos activos</span>
          )}
        </div>

        {isPending ? (
          <CargandoFilas filas={8} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.items.length === 0 ? (
          <SinDatos mensaje={filtros.busqueda ? "Ningún producto coincide con la búsqueda." : "No hay productos."} />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Vendidos (90 días)</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => {
                  const m = margen(p.precioVenta, p.costo);
                  return (
                    <TableRow key={p.id} className={p.activo ? undefined : "opacity-60"}>
                      <TableCell className="font-medium">
                        <Link prefetch={false} href={`/productos/${p.id}`} className="hover:underline">
                          {p.nombre}
                        </Link>
                        {!p.activo && <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>}
                        <span className="block text-xs font-normal text-muted-foreground">{p.usaVariantes ? "SKU por variante" : (p.sku ?? "")}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.categoriaNombre ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.precioVenta == null ? "—" : formatoPesos(p.precioVenta)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.costo == null ? "—" : formatoPesos(p.costo)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m == null ? "—" : `${m}%`}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoNumero(p.vendidos)}</TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${p.stock <= 0 ? "text-destructive" : ""}`}
                      >
                        {formatoNumero(p.stock)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <Paginacion
            pagina={filtros.pagina}
            porPagina={POR_PAGINA}
            total={data.total}
            onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
