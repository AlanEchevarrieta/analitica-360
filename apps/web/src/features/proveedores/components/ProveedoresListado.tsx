"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { linkWhatsApp } from "@/features/clientes/hooks/use-clientes";
import { useProveedoresLista } from "../hooks/use-proveedores";

export function ProveedoresListado() {
  const [busqueda, setBusqueda] = useState("");
  const { data, isPending, isError, error, refetch } = useProveedoresLista(busqueda);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Input className="max-w-sm" placeholder="Buscar proveedor" aria-label="Buscar proveedor" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {isPending ? (
          <CargandoFilas filas={5} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.items.length === 0 ? (
          <SinDatos mensaje={busqueda ? "Ningún proveedor coincide." : "Todavía no hay proveedores."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Qué provee</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Condiciones de pago</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => {
                const wa = linkWhatsApp(p.telefono, "Hola! ");
                return (
                  <TableRow key={p.id} className={p.activo ? undefined : "opacity-50"}>
                    <TableCell className="font-medium">
                      <Link href={`/proveedores/${p.id}`} className="hover:underline">
                        {p.nombre}
                      </Link>
                      {!p.activo && <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">{p.productosQueProvee ?? "—"}</TableCell>
                    <TableCell>{p.nombreVendedor ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.condicionesPago ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`WhatsApp a ${p.nombre}`}>
                          <MessageCircle aria-hidden />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
