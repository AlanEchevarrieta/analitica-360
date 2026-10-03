"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Paginacion } from "@/components/shared/paginacion";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { useApiFetch } from "@/hooks/use-api";
import { usePuedeExportar } from "@/hooks/use-suscripcion";
import { descargarCsv } from "@/lib/csv";
import { formatoFechaHora, formatoNumero, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { GRUPOS, POR_PAGINA, consultaMovimientos, useMovimientos, useUbicacionesMovimientos, type FilaMovimiento, type GrupoMovimiento, type RespuestaMovimientos } from "../use-movimientos";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const SENTIDO = {
  entra: { Icono: ArrowDownLeft, clase: "text-emerald-600 dark:text-emerald-400", signo: "+" },
  sale: { Icono: ArrowUpRight, clase: "text-red-500 dark:text-red-400", signo: "−" },
  traslado: { Icono: ArrowRightLeft, clase: "text-muted-foreground", signo: "" },
} as const;

function Ubicacion({ m }: { m: FilaMovimiento }) {
  if (m.sentido === "traslado") return <>{m.ubicacionOrigen ?? "—"} → {m.ubicacionDestino ?? "—"}</>;
  return <>{m.ubicacionDestino ?? m.ubicacionOrigen ?? "—"}</>;
}

/** Todos los movimientos de stock de todos los productos, como el kardex pero juntos. */
export function MovimientosVista() {
  const periodo = useRangoFechas("mes");
  const [f, setF] = useState({ grupo: "" as GrupoMovimiento | "", ubicacion: "", busqueda: "", pagina: 1 });
  const cambiar = (c: Partial<typeof f>) => setF((v) => ({ ...v, pagina: 1, ...c }));
  const filtros = { desde: periodo.desde, hasta: periodo.hasta, ...f };
  const { data, isPending, isError, error, refetch, isFetching } = useMovimientos(filtros);
  const ubicaciones = useUbicacionesMovimientos();
  const puedeExportar = usePuedeExportar();
  const api = useApiFetch();
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      const r = await api<RespuestaMovimientos>(consultaMovimientos(filtros, 1, 5000));
      if (r.items.length === 0) return toast.info("No hay movimientos para exportar.");
      descargarCsv(
        `movimientos-${periodo.desde}-a-${periodo.hasta}`,
        r.items.map((m) => ({
          Fecha: formatoFechaHora(m.fecha),
          Producto: m.producto,
          Variante: m.variante ?? "",
          Movimiento: m.tipoNombre,
          Entra: m.sentido === "entra" ? m.cantidad : "",
          Sale: m.sentido === "sale" ? m.cantidad : "",
          Traslado: m.sentido === "traslado" ? m.cantidad : "",
          ...(r.verCostos ? { "Costo unitario": m.costoUnitario ?? "", Valor: m.valor ?? "" } : {}),
          Ubicación: m.sentido === "traslado" ? `${m.ubicacionOrigen ?? ""} → ${m.ubicacionDestino ?? ""}` : (m.ubicacionDestino ?? m.ubicacionOrigen ?? ""),
          Origen: m.origen?.texto ?? m.motivo ?? "",
          Usuario: m.usuario ?? "",
        })),
      );
      if (r.total > r.items.length) toast.info(`Se exportaron los ${r.items.length} más recientes de ${r.total}. Achicá el período para bajar el resto.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  }

  const t = data?.totales;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <SelectorPeriodo periodo={periodo} />
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Buscar producto" aria-label="Buscar producto" value={f.busqueda} onChange={(e) => cambiar({ busqueda: e.target.value })} />
          <select className={selectClase} aria-label="Tipo de movimiento" value={f.grupo} onChange={(e) => cambiar({ grupo: e.target.value as GrupoMovimiento | "" })}>
            {GRUPOS.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.etiqueta}
              </option>
            ))}
          </select>
          {(ubicaciones.data?.length ?? 0) > 1 && (
            <select className={selectClase} aria-label="Ubicación" value={f.ubicacion} onChange={(e) => cambiar({ ubicacion: e.target.value })}>
              <option value="">Todas las ubicaciones</option>
              {ubicaciones.data!.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
          {puedeExportar && (
            <Button variant="outline" className="sm:ml-auto" onClick={() => void exportar()} disabled={exportando || !data?.total}>
              {exportando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Exportar
            </Button>
          )}
        </div>

        {t && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Entró</p>
              <p className="text-lg font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{formatoNumero(t.entradas.cantidad)}</p>
              {t.entradas.valor != null && <p className="text-xs text-muted-foreground tabular-nums">{formatoPesos(t.entradas.valor)}</p>}
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Salió</p>
              <p className="text-lg font-semibold text-red-500 tabular-nums dark:text-red-400">−{formatoNumero(t.salidas.cantidad)}</p>
              {t.salidas.valor != null && <p className="text-xs text-muted-foreground tabular-nums">{formatoPesos(t.salidas.valor)}</p>}
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Movimientos</p>
              <p className="text-lg font-semibold tabular-nums">{formatoNumero(data.total)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{t.traslados} traslados</p>
            </div>
          </div>
        )}

        {isPending ? (
          <CargandoFilas filas={8} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.items.length === 0 ? (
          <SinDatos mensaje="No hay movimientos con estos filtros." />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="hidden md:table-cell">Movimiento</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  {data.verCostos && <TableHead className="hidden text-right lg:table-cell">Valor</TableHead>}
                  <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                  <TableHead className="hidden md:table-cell">Origen</TableHead>
                  <TableHead className="hidden xl:table-cell">Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((m) => {
                  const s = SENTIDO[m.sentido];
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-normal">
                        <Link prefetch={false} href={`/inventario/${m.productoId}`} className="font-medium hover:underline">
                          {m.producto}
                        </Link>
                        {m.variante && <span className="block text-xs text-muted-foreground">{m.variante}</span>}
                        {/* En el celular, lo secundario debajo del nombre. */}
                        <span className="block text-xs text-muted-foreground md:hidden">
                          {formatoFechaHora(m.fecha)} · {m.origen?.texto ?? m.tipoNombre}
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">{formatoFechaHora(m.fecha)}</TableCell>
                      <TableCell className="hidden md:table-cell">{m.tipoNombre}</TableCell>
                      <TableCell className={cn("text-right font-semibold whitespace-nowrap tabular-nums", s.clase)}>
                        <s.Icono className="mr-1 inline size-3.5" aria-hidden />
                        {s.signo}
                        {formatoNumero(m.cantidad)}
                      </TableCell>
                      {data.verCostos && (
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {m.valor == null ? "—" : formatoPesos(m.valor)}
                          {m.costoUnitario != null && <span className="block text-xs text-muted-foreground">{formatoPesos(m.costoUnitario)} c/u</span>}
                        </TableCell>
                      )}
                      <TableCell className="hidden text-sm lg:table-cell">
                        <Ubicacion m={m} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {m.origen?.ruta ? (
                          <Link prefetch={false} href={m.origen.ruta} className="hover:underline">
                            {m.origen.texto}
                          </Link>
                        ) : (
                          (m.origen?.texto ?? <span className="text-muted-foreground">{m.motivo ?? "—"}</span>)
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">{m.usuario ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Paginacion pagina={f.pagina} porPagina={POR_PAGINA} total={data.total} onCambiar={(pagina) => setF((v) => ({ ...v, pagina }))} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
