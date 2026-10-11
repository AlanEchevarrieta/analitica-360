"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { COLOR_ESTADO, formatoEnMoneda, NOMBRE_ESTADO, usePresupuestos, type EstadoPresupuesto } from "./use-presupuestos";

const FILTROS: { valor: EstadoPresupuesto | "todos"; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "aceptado", etiqueta: "Aceptados" },
  { valor: "vencido", etiqueta: "Vencidos" },
  { valor: "rechazado", etiqueta: "Rechazados" },
];

const dia = (f: string) => new Date(f.length === 10 ? `${f}T12:00:00` : f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function EstadoPresupuestoChip({ estado }: { estado: EstadoPresupuesto }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", COLOR_ESTADO[estado])}>{NOMBRE_ESTADO[estado]}</span>;
}

/** Ventas → Presupuestos: lista con filtro por estado y cuánto suma lo pendiente. */
export function PresupuestosListado() {
  const { data, isPending, isError, error, refetch } = usePresupuestos();
  const [filtro, setFiltro] = useState<EstadoPresupuesto | "todos">("todos");
  const router = useRouter();

  if (isPending) return <CargandoFilas />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (data.length === 0) return <SinDatos mensaje="Todavía no hiciste presupuestos. Creá el primero con el botón de arriba." />;

  const filas = filtro === "todos" ? data : data.filter((p) => p.estado === filtro);
  const pendientes = data.filter((p) => p.estado === "pendiente");
  const aceptados = data.filter((p) => p.estado === "aceptado").length;
  const cerrados = data.filter((p) => p.estado !== "pendiente").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          Pendientes: <span className="font-medium text-foreground">{pendientes.length}</span> por <span className="font-medium text-foreground tabular-nums">{formatoPesos(pendientes.reduce((s, p) => s + p.total, 0))}</span>
        </span>
        {cerrados > 0 && (
          <span>
            Aceptados: <span className="font-medium text-foreground">{Math.round((aceptados / cerrados) * 100)} %</span> de los que ya se resolvieron
          </span>
        )}
      </div>
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
      {filas.length === 0 ? (
        <SinDatos mensaje="No hay presupuestos con ese estado." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Válido hasta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/ventas/presupuestos/${p.id}`)}>
                <TableCell className="font-medium tabular-nums">
                  <Link href={`/ventas/presupuestos/${p.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {p.numero}
                  </Link>
                </TableCell>
                <TableCell>{p.clienteNombre ?? <span className="text-muted-foreground">Sin cliente</span>}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{dia(p.fecha)}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">{dia(p.validoHasta)}</TableCell>
                <TableCell>
                  <EstadoPresupuestoChip estado={p.estado} />
                  {p.numeroVenta && <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">→ {p.numeroVenta}</span>}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatoPesos(p.total)}
                  {p.enMoneda && <span className="block text-xs font-normal text-muted-foreground">{formatoEnMoneda(p.enMoneda.total, p.moneda)}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
