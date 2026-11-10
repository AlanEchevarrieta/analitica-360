"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  COLOR_ESTADO_PROYECTO,
  NOMBRE_ESTADO_PROYECTO,
  fechaCortaAR,
  useProyectos,
  type FiltrosProyectos,
} from "./use-proyectos";

/** Tabla de proyectos con número, cliente, etapa actual, responsable, avance y atraso. */
export function ListaProyectos({ filtros }: { filtros: FiltrosProyectos }) {
  const { data, isPending, isError, error, refetch } = useProyectos(filtros);
  const router = useRouter();

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (!data || data.length === 0) {
    return <SinDatos mensaje="No hay proyectos para mostrar con estos filtros." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Proyecto y cliente</TableHead>
          <TableHead>Etapa actual</TableHead>
          <TableHead className="hidden md:table-cell">Responsable</TableHead>
          <TableHead className="hidden sm:table-cell">Avance</TableHead>
          <TableHead className="hidden sm:table-cell">Comprometida</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((p) => (
          <TableRow
            key={p.id}
            className="cursor-pointer"
            onClick={() => router.push(`/proyectos/${p.id}`)}
          >
            <TableCell className="font-mono text-xs font-medium tabular-nums">
              <Link
                href={`/proyectos/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {p.codigo}
              </Link>
            </TableCell>
            <TableCell>
              <span className="font-medium">{p.nombre}</span>
              <span className="block text-xs text-muted-foreground">
                {p.clienteNombre ?? "Sin cliente"}
              </span>
            </TableCell>
            <TableCell>
              {p.etapaActual ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">{p.etapaActual.nombre}</span>
                  {p.esperandoCliente && (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      🟡 Esperando al cliente · {p.diasEsperandoCliente} d
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Todas cerradas</span>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {p.responsableNombre ?? "—"}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <div className="flex w-28 flex-col gap-1">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {p.avance.cerradas}/{p.avance.total} ({p.avance.porcentaje}%)
                </span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${p.avance.porcentaje}%` }}
                  />
                </div>
              </div>
            </TableCell>
            <TableCell
              className={cn(
                "hidden tabular-nums sm:table-cell",
                p.atrasado && "font-medium text-red-600 dark:text-red-400",
              )}
            >
              {fechaCortaAR(p.fechaComprometida)}
              {p.atrasado && p.diasAtraso > 0 && (
                <span className="block text-[11px]">🔴 +{p.diasAtraso} d</span>
              )}
            </TableCell>
            <TableCell>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                  COLOR_ESTADO_PROYECTO[p.estado],
                )}
              >
                {NOMBRE_ESTADO_PROYECTO[p.estado]}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
