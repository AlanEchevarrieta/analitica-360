"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { useClientesLista } from "../hooks/use-clientes";

const fecha = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export function ClientesListado() {
  const { data, isPending, isError, error, refetch } = useClientesLista();
  const [busqueda, setBusqueda] = useState("");
  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data ?? []).filter(
      (c) => !q || c.nombre.toLowerCase().includes(q) || (c.telefono ?? "").includes(q) || c.etiquetas.some((e) => e.toLowerCase().includes(q)),
    );
  }, [data, busqueda]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Input className="max-w-sm" placeholder="Buscar por nombre, teléfono o etiqueta" aria-label="Buscar clientes" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {isPending ? (
          <CargandoFilas filas={6} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : filas.length === 0 ? (
          <SinDatos mensaje={busqueda ? "Ningún cliente coincide." : "Todavía no hay clientes. Se crean desde acá o al cargar una venta con un cliente nuevo."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Total gastado</TableHead>
                <TableHead>Última compra</TableHead>
                <TableHead>Etiquetas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clientes/${c.id}`} className="hover:underline">
                      {c.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{c.telefono ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoNumero(c.cantidadCompras)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoPesos(c.totalGastado)}</TableCell>
                  <TableCell className="tabular-nums">{fecha(c.ultimaCompra)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.etiquetas.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
