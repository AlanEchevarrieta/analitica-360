"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Paginacion } from "@/components/shared/paginacion";
import { formatoPesos } from "@/lib/formato";
import { COMPRAS_POR_PAGINA, useCompras } from "../hooks/use-compras";

/** "2026-09-25" -> "25/09/2026" sin pasar por Date (evita el corrimiento de zona horaria). */
function fechaCorta(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function ComprasListado() {
  const [pagina, setPagina] = useState(1);
  const [proveedor, setProveedor] = useState("");
  const { data, isPending, isError, error, refetch, isFetching } = useCompras(pagina, proveedor);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Input
          className="max-w-sm"
          placeholder="Buscar por proveedor"
          aria-label="Buscar por proveedor"
          value={proveedor}
          onChange={(e) => {
            setProveedor(e.target.value);
            setPagina(1);
          }}
        />

        {isPending ? (
          <CargandoFilas filas={8} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.items.length === 0 ? (
          <SinDatos mensaje={proveedor ? "No hay compras de ese proveedor." : "Todavía no hay compras."} />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Mercadería</TableHead>
                  <TableHead className="text-right">Flete / impuestos / otros</TableHead>
                  <TableHead className="text-right">Total real</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums">{fechaCorta(c.fecha)}</TableCell>
                    <TableCell>{c.proveedorNombre ?? <span className="text-muted-foreground">Sin proveedor</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoPesos(c.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {c.totalCostosAdicionales > 0 ? formatoPesos(c.totalCostosAdicionales) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {c.aCredito && <span className="mr-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-normal text-amber-600">A crédito</span>}
                      {formatoPesos(c.totalReal)}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground" title={c.notas ?? undefined}>
                      {c.notas ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && <Paginacion pagina={pagina} porPagina={COMPRAS_POR_PAGINA} total={data.total} onCambiar={setPagina} />}
      </CardContent>
    </Card>
  );
}
