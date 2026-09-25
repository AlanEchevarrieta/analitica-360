"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { useProductos } from "@/features/productos/hooks/use-productos";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

// La API pagina de a 200 como máximo; alcanza para el catálogo de una pyme.
const MAXIMO = 200;

/**
 * Stock actual de los productos activos, de menor a mayor, con el umbral de
 * alerta del dashboard (configuracion_empresa.inventario.umbral_stock_bajo).
 */
export function StockListado() {
  const [busqueda, setBusqueda] = useState("");
  const productos = useProductos({ pagina: 1, pageSize: MAXIMO, busqueda: "", estado: "activos" });
  const dashboard = useDashboard();

  const enAlerta = useMemo(
    () => new Set((dashboard.data?.alertasStock ?? []).map((a) => a.nombre)),
    [dashboard.data],
  );
  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (productos.data?.items ?? [])
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, "es"));
  }, [productos.data, busqueda]);

  const valorStock = filas.reduce((acc, p) => acc + Math.max(0, p.stock) * (p.costo ?? 0), 0);
  const sinStock = filas.filter((p) => p.stock <= 0).length;

  if (productos.isPending) return <CargandoFilas filas={10} />;
  if (productos.isError) return <ErrorDatos error={productos.error} onReintentar={() => productos.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Productos activos</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoNumero(productos.data.activos)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Stock bajo o sin stock</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatoNumero(enAlerta.size)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({sinStock} sin stock)</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Valor del stock (a costo)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoPesos(valorStock)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock por producto</CardTitle>
          <CardDescription>Ordenado de menor a mayor stock</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            className="max-w-sm"
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {filas.length === 0 ? (
            <SinDatos mensaje="Ningún producto coincide con la búsqueda." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{p.categoriaNombre ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoNumero(p.stock)}</TableCell>
                    <TableCell>
                      {p.stock <= 0 ? (
                        <span className="text-destructive">Sin stock</span>
                      ) : enAlerta.has(p.nombre) ? (
                        <span className="text-amber-500">Stock bajo</span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
