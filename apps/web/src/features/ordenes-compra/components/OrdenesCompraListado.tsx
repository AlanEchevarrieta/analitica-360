"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { COLOR_ESTADO_OC, NOMBRE_ESTADO_OC, useOrdenesCompra, type EstadoOc } from "../hooks/use-ordenes-compra";

const FILTROS: { valor: string; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todas" },
  { valor: "borrador", etiqueta: "Borradores" },
  { valor: "enviada", etiqueta: "Enviadas" },
  { valor: "confirmada", etiqueta: "Confirmadas" },
  { valor: "recibida_parcial", etiqueta: "Llegó una parte" },
  { valor: "recibida", etiqueta: "Recibidas" },
  { valor: "cancelada", etiqueta: "Canceladas" },
];

const dia = (f: string) => new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function EstadoOcChip({ estado }: { estado: EstadoOc }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", COLOR_ESTADO_OC[estado])}>{NOMBRE_ESTADO_OC[estado]}</span>;
}

/** Compras → Órdenes de compra: lo que se le pidió a cada proveedor y si ya llegó. */
export function OrdenesCompraListado() {
  const [filtro, setFiltro] = useState("todos");
  const { data, isPending, isError, error, refetch } = useOrdenesCompra(filtro);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="tab"
            aria-selected={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn("rounded-md px-3 py-1 text-sm", filtro === f.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>
      {isPending ? (
        <CargandoFilas />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : data.length === 0 ? (
        <SinDatos mensaje={filtro === "todos" ? "Todavía no hiciste órdenes de compra. Creá la primera con el botón de arriba." : "No hay órdenes con ese estado."} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Entrega estimada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/compras/ordenes/${o.id}`)}>
                <TableCell className="font-medium tabular-nums">
                  <Link href={`/compras/ordenes/${o.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {o.numeroOc}
                  </Link>
                </TableCell>
                <TableCell>{o.proveedorNombre ?? <span className="text-muted-foreground">Sin proveedor</span>}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{dia(o.fechaEmision)}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">{o.fechaEntregaEstimada ? dia(o.fechaEntregaEstimada) : "—"}</TableCell>
                <TableCell>
                  <EstadoOcChip estado={o.estado} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatoPesos(o.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
