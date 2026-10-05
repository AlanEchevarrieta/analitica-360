"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoMoneda } from "@/lib/formato";
import { diasEntre, hoyAR } from "@/lib/periodos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { Kpi } from "./comunes";
import { MatrizProductos } from "./MatrizProductos";
import { useGananciaProductos, type GananciaProducto } from "../hooks/use-ganancia-productos";

type Orden = "margen" | "total" | "unidades" | "margenPct";

export function GananciaProductos() {
  const periodo = useRangoFechas("mes");
  const [orden, setOrden] = useState<Orden>("margen");
  const { desde, hasta, rango } = periodo;
  const { data, isPending, isError, error, refetch, isFetching } = useGananciaProductos(desde, hasta);

  const productos = useMemo(
    () => [...(data?.data?.productos ?? [])].sort((a, b) => b[orden] - a[orden]),
    [data, orden],
  );
  const totales = productos.reduce(
    (acc, p) => ({ total: acc.total + p.total, costo: acc.costo + p.costo, unidades: acc.unidades + p.unidades }),
    { total: 0, costo: 0, unidades: 0 },
  );
  const ganancia = totales.total - totales.costo;
  // Rotación = unidades por día del período (hasta hoy). En "todos los datos" no tiene sentido.
  const diasPeriodo = rango === "todo" ? null : diasEntre(desde, hasta < hoyAR() ? hasta : hoyAR());
  const margenPct = totales.total > 0 ? (ganancia / totales.total) * 100 : 0;

  const columna = (clave: Orden, etiqueta: string) => (
    <TableHead className="text-right">
      <button
        type="button"
        className={`hover:text-foreground ${orden === clave ? "text-foreground underline underline-offset-4" : ""}`}
        onClick={() => setOrden(clave)}
      >
        {etiqueta}
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo periodo={periodo} />

      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : data.avisoLimite ? (
        <SinDatos mensaje={`El período tiene ${formatoNumero(data.avisoLimite)} ventas: elegí uno más corto.`} />
      ) : (
        <div className={`flex flex-col gap-4 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Vendido (neto de descuentos)" valor={formatoMoneda(totales.total)} detalle={`${formatoNumero(totales.unidades)} unidades`} />
            <Kpi titulo="Costo de lo vendido" valor={formatoMoneda(totales.costo)} />
            <Kpi titulo="Ganancia bruta" valor={formatoMoneda(ganancia)} />
            <Kpi titulo="Margen" valor={`${margenPct.toFixed(1)}%`} />
          </div>

          <MatrizProductos productos={productos} />

          <Card>
            <CardHeader>
              <CardTitle>Ganancia por producto</CardTitle>
              <CardDescription className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                El costo es el que tenía cada producto al momento de venderlo (costo promedio ponderado de las compras,
                con flete e impuestos). No incluye el interés de las cuotas ni gastos del negocio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productos.length === 0 ? (
                <SinDatos mensaje="No hubo ventas en este período." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      {columna("unidades", "Unidades")}
                      {diasPeriodo && <TableHead className="text-right">Rotación</TableHead>}
                      {columna("total", "Vendido")}
                      <TableHead className="text-right">Costo</TableHead>
                      {columna("margen", "Ganancia")}
                      {columna("margenPct", "Margen")}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productos.map((p: GananciaProducto) => (
                      <TableRow key={p.producto}>
                        <TableCell className="font-medium">{p.producto}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatoNumero(p.unidades)}</TableCell>
                        {diasPeriodo && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {(p.unidades / diasPeriodo).toLocaleString("es-AR", { maximumFractionDigits: 1 })} u/día
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">{formatoMoneda(p.total)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatoMoneda(p.costo)}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${p.margen < 0 ? "text-destructive" : ""}`}>
                          {formatoMoneda(p.margen)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.margenPct.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
