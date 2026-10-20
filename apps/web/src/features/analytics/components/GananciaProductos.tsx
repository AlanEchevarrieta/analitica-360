"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoMoneda } from "@/lib/formato";
import { diasEntre, hoyAR, moverDias } from "@/lib/periodos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { Kpi } from "./comunes";
import { MatrizProductos } from "./MatrizProductos";
import { useGananciaProductos, type GananciaProducto } from "../hooks/use-ganancia-productos";

type Orden = "margen" | "total" | "unidades" | "margenPct" | "tendencia";

/** Debajo de este total de unidades (sumando los dos períodos) la tendencia es ruido: se muestra sin porcentaje. */
const MIN_UNIDADES_TENDENCIA = 4;

/** Cambio de unidades frente al período anterior: null si no hay con qué comparar. */
function tendenciaDe(actual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || actual + anterior < MIN_UNIDADES_TENDENCIA) return null;
  if (anterior === 0) return Infinity;
  return actual / anterior - 1;
}

function Tendencia({ actual, anterior }: { actual: number; anterior: number | undefined }) {
  const t = tendenciaDe(actual, anterior);
  const detalle = `${formatoNumero(actual)} u. ahora · ${formatoNumero(anterior ?? 0)} u. en el período anterior`;
  if (t === null) return <span className="text-muted-foreground" title={detalle}>—</span>;
  if (t === Infinity) return <span className="font-medium text-emerald-600 dark:text-emerald-400" title={detalle}>Nuevo</span>;
  const texto = `${t > 0 ? "+" : ""}${(t * 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })}%`;
  const color = t > 0.05 ? "text-emerald-600 dark:text-emerald-400" : t < -0.05 ? "text-destructive" : "text-muted-foreground";
  return <span className={`font-medium ${color}`} title={detalle}>{texto}</span>;
}

export function GananciaProductos() {
  const periodo = useRangoFechas("mes");
  const [orden, setOrden] = useState<Orden>("margen");
  const { desde, hasta, rango } = periodo;
  const { data, isPending, isError, error, refetch, isFetching } = useGananciaProductos(desde, hasta);

  // Período anterior de la misma duración (hasta hoy, si el período elegido todavía no terminó).
  const hastaEfectivo = hasta < hoyAR() ? hasta : hoyAR();
  const duracion = diasEntre(desde, hastaEfectivo);
  const conTendencia = rango !== "todo";
  const anterior = useGananciaProductos(
    conTendencia ? moverDias(desde, -duracion) : "",
    conTendencia ? moverDias(desde, -1) : "",
  );
  const unidadesAntes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of anterior.data?.data?.productos ?? []) m.set(p.producto, p.unidades);
    return m;
  }, [anterior.data]);
  // Si en el primer cuarto del período anterior no hay ninguna venta, casi seguro es que todavía no había datos
  // cargados (por ejemplo, antes de pasar del sistema anterior): comparar inflaría la tendencia.
  const desdeAnterior = moverDias(desde, -duracion);
  const primeraVentaAntes = anterior.data?.data?.evolucionDiaria?.[0]?.fecha;
  const anteriorIncompleto = !primeraVentaAntes || primeraVentaAntes > moverDias(desdeAnterior, Math.floor(duracion / 4));
  const tendenciaListaCargada = conTendencia && anterior.isSuccess && !anterior.data?.avisoLimite && !anteriorIncompleto;

  const productos = useMemo(() => {
    const valor = (p: GananciaProducto) => {
      if (orden !== "tendencia") return p[orden];
      const t = tendenciaDe(p.unidades, unidadesAntes.get(p.producto) ?? 0);
      return t === null ? -Infinity : t;
    };
    return [...(data?.data?.productos ?? [])].sort((a, b) => valor(b) - valor(a));
  }, [data, orden, unidadesAntes]);
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
                {tendenciaListaCargada &&
                  ` Tendencia: unidades vendidas frente al período anterior de la misma duración (${duracion} días); con muy pocas ventas no se calcula.`}
                {conTendencia && anterior.isSuccess && anteriorIncompleto &&
                  ` Para ver la tendencia elegí un período más corto: el período anterior de ${duracion} días empieza antes de tus primeras ventas registradas.`}
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
                      {tendenciaListaCargada && columna("tendencia", "Tendencia")}
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
                        {tendenciaListaCargada && (
                          <TableCell className="text-right tabular-nums">
                            <Tendencia actual={p.unidades} anterior={unidadesAntes.get(p.producto) ?? 0} />
                          </TableCell>
                        )}
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
