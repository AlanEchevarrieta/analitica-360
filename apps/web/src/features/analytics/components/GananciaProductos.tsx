"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { useGananciaProductos, type GananciaProducto } from "../hooks/use-ganancia-productos";

type Rango = "mes" | "mesPasado" | "90dias" | "anio";

const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "mesPasado", etiqueta: "Mes pasado" },
  { valor: "90dias", etiqueta: "Últimos 90 días" },
  { valor: "anio", etiqueta: "Este año" },
];

type Orden = "margen" | "total" | "unidades" | "margenPct";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function fechasDe(rango: Rango): { desde: string; hasta: string } {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  switch (rango) {
    case "mes":
      return { desde: iso(new Date(Date.UTC(y, m, 1))), hasta: iso(hoy) };
    case "mesPasado":
      return { desde: iso(new Date(Date.UTC(y, m - 1, 1))), hasta: iso(new Date(Date.UTC(y, m, 0))) };
    case "90dias":
      return { desde: iso(new Date(hoy.getTime() - 89 * 86_400_000)), hasta: iso(hoy) };
    case "anio":
      return { desde: `${y}-01-01`, hasta: iso(hoy) };
  }
}

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </CardHeader>
    </Card>
  );
}

export function GananciaProductos() {
  const [rango, setRango] = useState<Rango>("mes");
  const [orden, setOrden] = useState<Orden>("margen");
  const { desde, hasta } = fechasDe(rango);
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
      <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
        {RANGOS.map((r) => (
          <Button
            key={r.valor}
            size="sm"
            variant={rango === r.valor ? "secondary" : "ghost"}
            aria-pressed={rango === r.valor}
            onClick={() => setRango(r.valor)}
          >
            {r.etiqueta}
          </Button>
        ))}
      </div>

      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : data.avisoLimite ? (
        <SinDatos mensaje={`El período tiene ${formatoNumero(data.avisoLimite)} ventas: elegí uno más corto.`} />
      ) : (
        <div className={`flex flex-col gap-4 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Vendido (neto de descuentos)" valor={formatoPesos(totales.total)} detalle={`${formatoNumero(totales.unidades)} unidades`} />
            <Kpi titulo="Costo de lo vendido" valor={formatoPesos(totales.costo)} />
            <Kpi titulo="Ganancia bruta" valor={formatoPesos(ganancia)} />
            <Kpi titulo="Margen" valor={`${margenPct.toFixed(1)}%`} />
          </div>

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
                        <TableCell className="text-right tabular-nums">{formatoPesos(p.total)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatoPesos(p.costo)}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${p.margen < 0 ? "text-destructive" : ""}`}>
                          {formatoPesos(p.margen)}
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
