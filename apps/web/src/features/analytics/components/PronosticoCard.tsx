"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoMoneda } from "@/lib/formato";
import { etiquetaFecha } from "@/lib/periodos";
import type { InsightForecast } from "../types";

const GRAFICO_PRONOSTICO = {
  historico: { label: "Real", color: "var(--chart-1)" },
  proyeccion: { label: "Proyección", color: "var(--chart-2)" },
  rango: { label: "Rango probable", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TENDENCIA = { positiva: "📈 en alza", negativa: "📉 en baja", neutra: "➡️ estable" } as const;

function calificar(errorPct: number): string {
  if (errorPct < 15) return "bastante certero";
  if (errorPct < 30) return "orientativo";
  return "poco confiable";
}

export function PronosticoCard({
  forecast,
  pronostico,
  onPronostico,
  error,
}: {
  forecast: InsightForecast | null;
  pronostico: "semana" | "mes";
  onPronostico: (p: "semana" | "mes") => void;
  error?: string;
}) {
  const etiquetaPeriodo = (l: string) => (pronostico === "semana" ? `Semana del ${etiquetaFecha(l)}` : etiquetaFecha(l.slice(0, 7)));
  const HorizonteCorto = pronostico === "semana" ? "Próximas 4 semanas" : "Próximos 3 meses";

  const descripcion = !forecast
    ? (error ?? "Hacen falta al menos 30 días de ventas para proyectar.")
    : forecast.totalRango
      ? `${HorizonteCorto}: entre ${formatoMoneda(forecast.totalRango.min)} y ${formatoMoneda(forecast.totalRango.max)}`
      : `${forecast.etiquetaProyeccion}: ${formatoMoneda(forecast.totalProyeccion)}`;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle>Pronóstico de ventas {forecast ? TENDENCIA[forecast.tendencia] : ""}</CardTitle>
          <div className="flex gap-1" role="group" aria-label="Pronóstico por">
            {(["semana", "mes"] as const).map((g) => (
              <Button key={g} size="xs" variant={pronostico === g ? "secondary" : "ghost"} aria-pressed={pronostico === g} onClick={() => onPronostico(g)}>
                {g === "semana" ? "Semanal" : "Mensual"}
              </Button>
            ))}
          </div>
        </div>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      {forecast && (
        <CardContent className="flex flex-col gap-3">
          <div className="h-64">
            <ChartContainer config={GRAFICO_PRONOSTICO} className="aspect-auto h-full w-full">
              <ComposedChart data={forecast.puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="clave" tickFormatter={etiquetaFecha} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v: number) => formatoMoneda(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const punto = payload[0]?.payload as InsightForecast["puntos"][number] | undefined;
                    if (!punto) return null;
                    const esProyectado = punto.historico == null && punto.proyeccion != null;
                    return (
                      <div className="rounded-lg border bg-background p-2.5 text-xs shadow-md">
                        <div className="mb-1 font-medium">{etiquetaPeriodo(String(label))}</div>
                        {esProyectado ? (
                          <div className="tabular-nums">
                            Proyección {formatoMoneda(punto.proyeccion ?? 0)}
                            {punto.rango && ` · entre ${formatoMoneda(punto.rango[0])} y ${formatoMoneda(punto.rango[1])}`}
                          </div>
                        ) : (
                          <div className="tabular-nums">Real {formatoMoneda(punto.historico ?? 0)}</div>
                        )}
                      </div>
                    );
                  }}
                />
                <Area dataKey="rango" fill="var(--color-proyeccion)" fillOpacity={0.15} stroke="none" connectNulls={false} />
                <Line dataKey="historico" stroke="var(--color-historico)" strokeWidth={2} dot={false} connectNulls={false} />
                <Line dataKey="proyeccion" stroke="var(--color-proyeccion)" strokeDasharray="5 5" strokeWidth={2} dot={false} connectNulls={false} />
                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            {forecast.precision
              ? `Precisión: ${calificar(forecast.precision.errorPct)} (±${Math.round(forecast.precision.errorPct)} %)`
              : "Todavía no hay historia suficiente para medir la precisión"}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
