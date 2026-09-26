"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { formatoNumero } from "@/lib/formato";
import { useCapacidadAdmin } from "../hooks/use-admin";
import { Indicador, Panel } from "./comunes";
import { TopesMonotributo } from "./TopesMonotributo";

function tamano(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toLocaleString("es-AR", { maximumFractionDigits: 2 })} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Espacio que ocupa cada cliente y cómo crece la base (reemplaza el cupo del plan Free de Supabase). */
export function SistemaVista() {
  const { data: c, isPending, isError, error, refetch } = useCapacidadAdmin();
  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const bytesPorRegistro = c.totalRegistros ? c.baseBytes / c.totalRegistros : 0;
  const crecimientoMes = c.registrosUltimoMes * bytesPorRegistro;

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Sistema</h1>
        <p className="text-sm text-muted-foreground">Cuánto ocupa la base de datos y a qué ritmo crece. Sirve para elegir y dimensionar el hosting.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador etiqueta="Base de datos" valor={tamano(c.baseBytes)} detalle="Tamaño total en disco" />
        <Indicador etiqueta="Registros" valor={formatoNumero(c.totalRegistros)} detalle="Ventas, productos, clientes y movimientos" />
        <Indicador etiqueta="Nuevos este mes" valor={formatoNumero(c.registrosUltimoMes)} detalle={`≈ ${tamano(crecimientoMes)} por mes a este ritmo`} />
        <Indicador etiqueta="Empresas activas" valor={formatoNumero(c.empresas)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Registros por tipo">
          <ul className="flex flex-col gap-2 text-sm">
            {[
              ["Ventas", c.ventas],
              ["Movimientos de stock", c.movimientos],
              ["Productos", c.productos],
              ["Clientes", c.clientes],
            ].map(([n, v]) => (
              <li key={String(n)} className="flex items-center gap-3">
                <span className="w-44">{n}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${c.totalRegistros ? (Number(v) / c.totalRegistros) * 100 : 0}%` }} />
                </div>
                <span className="w-20 text-right tabular-nums">{formatoNumero(Number(v))}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel titulo="Tablas más pesadas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabla</TableHead>
                <TableHead className="text-right">Filas</TableHead>
                <TableHead className="text-right">Tamaño</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.tablas.map((t) => (
                <TableRow key={t.tabla}>
                  <TableCell className="font-mono text-xs">{t.tabla}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoNumero(t.filas)}</TableCell>
                  <TableCell className="text-right tabular-nums">{tamano(t.bytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
      <TopesMonotributo />
    </>
  );
}
