"use client";

import { useState } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoMoneda } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useRendimiento, type FilaRendimiento } from "../hooks/use-analytics";

const textoVariacion = (v: number | null) => (v == null ? "nuevo" : `${v > 0 ? "+" : ""}${v}%`);
const colorVariacion = (v: number | null) => (v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const GRAFICO = { pct: { label: "% de lo vendido", color: "var(--chart-1)" } } satisfies ChartConfig;

/** ¿Dónde y quién vende más? Participación, ticket promedio y cambio vs. el período anterior. */
export function RendimientoVentas({ desde, hasta }: { desde: string; hasta: string }) {
  const { data } = useRendimiento(desde, hasta);
  const [vista, setVista] = useState<"ubicacion" | "vendedor">("ubicacion");
  if (!data) return null;
  const filas = vista === "ubicacion" ? data.porUbicacion : data.porVendedor;
  const quien = vista === "ubicacion" ? "Stand" : "Vendedor";
  const ticketGeneral = filas.reduce((a, f) => a + f.total, 0) / Math.max(1, filas.reduce((a, f) => a + f.ventas, 0));
  const unoSolo = filas.length === 1;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>¿Dónde y quién vende más?</CardTitle>
          <CardDescription>
            Participación en lo vendido y ticket promedio. Comparado con el período anterior de la misma duración ({data.periodoAnterior.desde.split("-").reverse().join("/")} al{" "}
            {data.periodoAnterior.hasta.split("-").reverse().join("/")}).
          </CardDescription>
        </div>
        <div className="flex gap-1" role="group" aria-label="Ver por">
          {(["ubicacion", "vendedor"] as const).map((v) => (
            <Button key={v} size="sm" variant={vista === v ? "secondary" : "ghost"} aria-pressed={vista === v} onClick={() => setVista(v)}>
              {v === "ubicacion" ? "Por stand" : "Por vendedor"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {filas.length === 0 ? (
          <SinDatos mensaje="Sin ventas en el período." />
        ) : (
          <>
            <ChartContainer config={GRAFICO} className="aspect-auto w-full" style={{ height: Math.max(80, filas.length * 44 + 16) }}>
              <BarChart data={filas} layout="vertical" margin={{ left: 0, right: 48 }}>
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" dataKey="nombre" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel valueFormatter={(v) => `${v}%`} />} />
                <Bar dataKey="pct" fill="var(--color-pct)" radius={4}>
                  <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`} className="fill-foreground text-xs" />
                </Bar>
              </BarChart>
            </ChartContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{quien}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Ventas</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Total</TableHead>
                  <TableHead className="text-right">
                    <span className="sm:hidden">Ticket</span>
                    <span className="hidden sm:inline">Ticket promedio</span>
                  </TableHead>
                  <TableHead className="hidden text-right sm:table-cell">vs. antes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f: FilaRendimiento) => (
                  <TableRow key={f.clave || f.nombre}>
                    <TableCell className="font-medium">
                      {f.nombre}
                      <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                        {formatoNumero(f.ventas)} {f.ventas === 1 ? "venta" : "ventas"} · {formatoMoneda(f.total)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoNumero(f.ventas)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoMoneda(f.total)}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", !unoSolo && f.ticket > ticketGeneral * 1.1 && "text-emerald-600 dark:text-emerald-400")}>
                      {formatoMoneda(f.ticket)}
                      <span className={cn("block text-xs font-normal sm:hidden", colorVariacion(f.variacion))}>{f.variacion == null ? "nuevo" : `${textoVariacion(f.variacion)} vs. antes`}</span>
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", colorVariacion(f.variacion))}>{textoVariacion(f.variacion)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {unoSolo && (
              <p className="text-xs text-muted-foreground">
                {vista === "ubicacion"
                  ? "Todas las ventas del período salieron de un mismo lugar. Cuando vendas en otros stands (en Nueva venta, “Sale de”), vas a ver la comparación."
                  : "Todas las ventas del período las cargó la misma persona. Cuando tu equipo venda con su propio usuario, vas a ver quién vende más."}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
