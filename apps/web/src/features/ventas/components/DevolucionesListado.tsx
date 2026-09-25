"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora } from "@/lib/formato";
import { useAccionesDevolucion, useDevoluciones } from "../hooks/use-venta";

const ESTADO: Record<string, string> = { pendiente: "Pendiente", procesado: "Procesada", cancelado: "Cancelada" };

export function DevolucionesListado() {
  const { data, isPending, isError, error, refetch } = useDevoluciones();
  const acciones = useAccionesDevolucion();
  const error_ = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo completar");

  return (
    <Card>
      <CardContent>
        {isPending ? (
          <CargandoFilas filas={6} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.length === 0 ? (
          <SinDatos mensaje="No hay devoluciones ni cambios. Se registran desde la ficha de cada venta." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Venta</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id} className={d.estado === "cancelado" ? "opacity-50" : undefined}>
                  <TableCell className="tabular-nums">{d.numero}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatoFechaHora(d.fecha)}</TableCell>
                  <TableCell>{d.tipo === "cambio" ? "Cambio" : "Devolución"}</TableCell>
                  <TableCell>
                    {d.ventaId ? (
                      <Link href={`/ventas/${d.ventaId}`} className="hover:underline">
                        {d.ventaLabel ?? "Ver venta"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 truncate" title={d.productos}>
                    {d.productos}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.motivo ?? "—"}</TableCell>
                  <TableCell>{ESTADO[d.estado] ?? d.estado}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {d.estado === "pendiente" && (
                      <Button size="sm" variant="ghost" onClick={() => acciones.procesar.mutate(d.id, { onSuccess: () => toast.success("Marcada como procesada"), onError: error_ })}>
                        Procesada
                      </Button>
                    )}
                    {d.estado === "pendiente" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => acciones.cancelar.mutate(d.id, { onSuccess: () => toast.success("Cancelada"), onError: error_ })}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
