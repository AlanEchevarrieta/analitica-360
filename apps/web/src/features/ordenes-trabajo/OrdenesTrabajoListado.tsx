"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { COLOR_ESTADO_OT, NOMBRE_ESTADO_OT, useOrdenesTrabajo, type EstadoOt } from "./use-ordenes-trabajo";

const FILTROS = [
  { valor: "abiertas", etiqueta: "En curso" },
  { valor: "listo", etiqueta: "Listas para retirar" },
  { valor: "entregado", etiqueta: "Entregadas" },
  { valor: "cancelada", etiqueta: "Canceladas" },
  { valor: "todas", etiqueta: "Todas" },
];

const dia = (f: string) => new Date(f.length === 10 ? `${f}T12:00:00` : f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

export function EstadoOtChip({ estado }: { estado: EstadoOt }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", COLOR_ESTADO_OT[estado])}>{NOMBRE_ESTADO_OT[estado]}</span>;
}

/** Ventas → Órdenes de trabajo: lo que entró al taller y en qué etapa está. */
export function OrdenesTrabajoListado() {
  const [filtro, setFiltro] = useState("abiertas");
  const { data, isPending, isError, error, refetch } = useOrdenesTrabajo(filtro);
  const router = useRouter();
  const hoy = hoyAR();

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
        <SinDatos mensaje={filtro === "abiertas" ? "No hay trabajos en curso. Cargá uno cuando el cliente te deje un equipo." : "No hay órdenes con ese estado."} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente y equipo</TableHead>
              <TableHead className="hidden md:table-cell">Atiende</TableHead>
              <TableHead className="hidden sm:table-cell">Para el</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((o) => {
              const atrasada = o.fechaPrometida && o.fechaPrometida < hoy && (o.estado === "recibido" || o.estado === "en_proceso");
              return (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/ordenes-trabajo/${o.id}`)}>
                  <TableCell className="font-medium tabular-nums">
                    <Link href={`/ordenes-trabajo/${o.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {o.numero}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {o.clienteNombre ?? <span className="text-muted-foreground">Sin cliente</span>}
                    <span className="block text-xs text-muted-foreground">{o.equipo}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{o.responsable ?? "—"}</TableCell>
                  <TableCell className={cn("hidden tabular-nums sm:table-cell", atrasada && "font-medium text-red-600 dark:text-red-400")}>{o.fechaPrometida ? dia(o.fechaPrometida) : "—"}</TableCell>
                  <TableCell>
                    <EstadoOtChip estado={o.estado} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.total ? formatoPesos(o.total) : "—"}
                    {o.senia > 0 && <span className="block text-xs text-muted-foreground">seña {formatoPesos(o.senia)}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
