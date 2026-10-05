"use client";

import { CartesianGrid, Cell, LabelList, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoMoneda } from "@/lib/formato";
import type { GananciaProducto } from "../hooks/use-ganancia-productos";

type Cuadrante = "Estrella" | "Premium" | "Volumen" | "Revisar";

const CUADRANTES: Record<Cuadrante, { color: string; ayuda: string }> = {
  Estrella: { color: "var(--chart-2)", ayuda: "Se vende mucho y deja buen margen: cuidá su stock." },
  Premium: { color: "var(--chart-3)", ayuda: "Buen margen pero rota poco: dale más visibilidad." },
  Volumen: { color: "var(--chart-1)", ayuda: "Rota mucho con poco margen: revisá precio o costo." },
  Revisar: { color: "var(--chart-5)", ayuda: "Poca venta y poco margen: pensá si conviene seguir." },
};

const CONFIG = { productos: { label: "Productos" } } satisfies ChartConfig;

function cuadrante(unidades: number, margen: number, promU: number, promM: number): Cuadrante {
  const rota = unidades >= promU;
  const deja = margen >= promM;
  return deja ? (rota ? "Estrella" : "Premium") : rota ? "Volumen" : "Revisar";
}

const corto = (t: string) => (t.length > 16 ? `${t.slice(0, 15)}…` : t);

/**
 * Matriz rotación vs rentabilidad (como en el sistema anterior): cada producto
 * según unidades vendidas y margen, dividido por los promedios.
 */
export function MatrizProductos({ productos }: { productos: GananciaProducto[] }) {
  const conVentas = productos.filter((p) => p.unidades > 0);
  const promU = conVentas.reduce((a, p) => a + p.unidades, 0) / (conVentas.length || 1);
  const promM = conVentas.reduce((a, p) => a + p.margenPct, 0) / (conVentas.length || 1);
  // Nombre visible solo en los que rotan más que el promedio (los de la zona baja se amontonan; se ven al pasar el mouse).
  const puntos = conVentas.map((p) => ({ ...p, etiqueta: p.unidades >= promU ? corto(p.producto) : "", cuadrante: cuadrante(p.unidades, p.margenPct, promU, promM) }));
  const margenes = puntos.map((p) => p.margenPct);
  // Eje de margen ajustado a los datos (con margen de 5-10 puntos), sin bajar de 0 salvo que haya pérdidas.
  const minM = Math.min(...margenes, 100);
  const maxM = Math.max(...margenes, 0);
  const dominioY: [number, number] = [minM < 0 ? Math.floor(minM / 5) * 5 : Math.max(0, Math.floor((minM - 10) / 5) * 5), Math.ceil((maxM + 5) / 5) * 5];
  const cuenta = (c: Cuadrante) => puntos.filter((p) => p.cuadrante === c).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matriz de productos: rotación vs rentabilidad</CardTitle>
        <CardDescription>Las líneas punteadas son los promedios. Arriba a la derecha están tus estrellas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {puntos.length === 0 ? (
          <SinDatos mensaje="No hubo ventas en este período." />
        ) : (
          <>
            <div className="h-80">
              <ChartContainer config={CONFIG} className="aspect-auto h-full w-full">
                <ScatterChart margin={{ left: 8, right: 24, top: 16, bottom: 16 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="unidades" name="Unidades" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false}
                    label={{ value: "Unidades vendidas", position: "insideBottom", offset: -8, fontSize: 12 }} />
                  <YAxis type="number" dataKey="margenPct" name="Margen" unit="%" domain={dominioY} tickLine={false} axisLine={false} fontSize={12} width={48} />
                  <ReferenceLine x={promU} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                  <ReferenceLine y={promM} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                  <ChartTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      const p = active ? (payload?.[0]?.payload as (typeof puntos)[number] | undefined) : undefined;
                      if (!p) return null;
                      return (
                        <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <p className="font-medium">{p.producto}</p>
                          <p className="text-muted-foreground">
                            {formatoNumero(p.unidades)} unidades · margen {p.margenPct.toFixed(1)}% · ganancia {formatoMoneda(p.margen)}
                          </p>
                          <p style={{ color: CUADRANTES[p.cuadrante].color }} className="font-medium">
                            {p.cuadrante}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={puntos}>
                    {puntos.map((p) => (
                      <Cell key={p.producto} fill={CUADRANTES[p.cuadrante].color} />
                    ))}
                    <LabelList dataKey="etiqueta" position="top" fontSize={11} className="fill-muted-foreground" />
                  </Scatter>
                </ScatterChart>
              </ChartContainer>
            </div>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {(Object.keys(CUADRANTES) as Cuadrante[]).map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: CUADRANTES[c].color }} aria-hidden />
                  <span>
                    <b>{c}</b> ({cuenta(c)}): <span className="text-muted-foreground">{CUADRANTES[c].ayuda}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
