"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoMoneda } from "@/lib/formato";
import { etiquetaFecha } from "@/lib/periodos";
import type { InsightForecast } from "../types";

const GRAFICO_PRONOSTICO = {
  historico: { label: "Real cerrado", color: "var(--chart-1)" },
  pronosticado: { label: "Pronóstico retrospectivo", color: "var(--chart-4)" },
  proyeccion: { label: "Proyección futura", color: "var(--chart-2)" },
  realEnCurso: { label: "En curso (hoy)", color: "var(--chart-5)" },
} satisfies ChartConfig;

const TENDENCIA = { positiva: "📈 en alza", negativa: "📉 en baja", neutra: "➡️ estable" } as const;

function porcentaje(v: number) {
  return `${Math.abs(v).toFixed(1)} %`;
}

function calificar(errorPct: number): { texto: string; clase: string } {
  if (errorPct <= 12) return { texto: "Precisión muy alta (el modelo predice con gran exactitud)", clase: "text-emerald-500 font-medium" };
  if (errorPct <= 22) return { texto: "Precisión buena (rango esperable para este volumen de ventas)", clase: "text-cyan-500 font-medium" };
  if (errorPct <= 35) return { texto: "Precisión moderada (hay fluctuaciones en los períodos)", clase: "text-amber-500 font-medium" };
  return { texto: "Precisión baja (ventas irregulares o estacionales)", clase: "text-red-500 font-medium" };
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
  const periodo = pronostico === "semana" ? "semana" : "mes";
  const etiquetaPeriodo = (l: string) => (pronostico === "semana" ? `Semana del ${etiquetaFecha(l)}` : etiquetaFecha(l.slice(0, 7)));

  // Buscamos el primer punto futuro proyectado para colocar la línea divisoria de "Hoy"
  const primerFuturo = forecast?.puntos.find((p) => p.historico == null && p.proyeccion != null)?.clave;

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
        <CardDescription>
          {forecast
            ? `${forecast.etiquetaProyeccion}: ${formatoMoneda(forecast.totalProyeccion)} (tendencia de ${pronostico === "semana" ? "las últimas semanas completas" : "los últimos meses completos"})`
            : (error ?? "Hacen falta al menos 30 días de ventas para proyectar.")}
        </CardDescription>
      </CardHeader>
      {forecast && (
        <CardContent className="flex flex-col gap-4">
          <div className="h-64">
            <ChartContainer config={GRAFICO_PRONOSTICO} className="aspect-auto h-full w-full">
              <LineChart data={forecast.puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="clave" tickFormatter={etiquetaFecha} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v: number) => formatoMoneda(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(v) => formatoMoneda(Number(v))}
                      labelFormatter={(l) => etiquetaPeriodo(String(l))}
                    />
                  }
                />
                {primerFuturo && (
                  <ReferenceLine
                    x={primerFuturo}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    label={{ value: "Hoy", position: "insideTopLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                )}
                <Line dataKey="historico" stroke="var(--color-historico)" strokeWidth={2} dot={false} connectNulls={false} />
                <Line
                  dataKey="pronosticado"
                  stroke="var(--color-pronosticado)"
                  strokeDasharray="3 3"
                  strokeWidth={1.75}
                  dot={{ r: 2.5 }}
                  connectNulls={false}
                />
                <Line dataKey="proyeccion" stroke="var(--color-proyeccion)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line
                  dataKey="realEnCurso"
                  stroke="none"
                  dot={{ r: 4.5, fill: "var(--color-realEnCurso)" }}
                  legendType="circle"
                  isAnimationActive={false}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </LineChart>
            </ChartContainer>
          </div>
          <PrecisionPronostico forecast={forecast} periodo={periodo} etiquetaPeriodo={etiquetaPeriodo} />
        </CardContent>
      )}
    </Card>
  );
}

function PrecisionPronostico({
  forecast,
  periodo,
  etiquetaPeriodo,
}: {
  forecast: InsightForecast;
  periodo: string;
  etiquetaPeriodo: (l: string) => string;
}) {
  const { precision, enCurso } = forecast;
  if (!precision) {
    return (
      <p className="text-xs text-muted-foreground">
        Para comparar el pronóstico con lo real hacen falta al menos 5 {periodo === "semana" ? "semanas" : "meses"} de ventas.
      </p>
    );
  }
  const { ultimo } = precision;
  const nota = calificar(precision.errorPct);
  const vendioMas = ultimo.diferencia < 0;

  return (
    <div className="flex flex-col gap-2.5 pt-2 border-t border-border/50">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
        <Dato titulo={`Último ${periodo} cerrado`} detalle={etiquetaPeriodo(ultimo.clave)}>
          <p className="tabular-nums">
            Pronóstico {formatoMoneda(ultimo.pronosticado)} · Real {formatoMoneda(ultimo.real)}
          </p>
          <p className="font-medium tabular-nums text-foreground">
            Le erró por {formatoMoneda(Math.abs(ultimo.diferencia))}
            {ultimo.diferenciaPct != null && ` (${porcentaje(ultimo.diferenciaPct)})`}: vendiste {vendioMas ? "más" : "menos"} de lo proyectado
          </p>
        </Dato>
        <Dato titulo="Error promedio" detalle={`últimos ${precision.periodos} ${periodo === "semana" ? "semanas" : "meses"}`}>
          <p className="font-medium tabular-nums text-foreground">
            ± {porcentaje(precision.errorPct)} · {formatoMoneda(precision.errorPromedio)} por {periodo}
          </p>
          <p className={nota.clase}>{nota.texto}</p>
        </Dato>
        {enCurso ? (
          <Dato titulo={`Este ${periodo}, hasta hoy`} detalle="período en curso">
            <p className="tabular-nums">
              Van {formatoMoneda(enCurso.real)} de {formatoMoneda(enCurso.pronosticado)}
            </p>
            <p className="font-medium tabular-nums text-foreground">
              {enCurso.pronosticado > 0 ? `${((enCurso.real / enCurso.pronosticado) * 100).toFixed(0)} % de lo pronosticado` : "Sin pronóstico para comparar"}
            </p>
          </Dato>
        ) : (
          <Dato titulo="Sesgo del modelo" detalle={`últimos ${precision.periodos} ${periodo === "semana" ? "semanas" : "meses"}`}>
            <p className="font-medium text-foreground">{sesgoTexto(precision.sesgoPct)}</p>
          </Dato>
        )}
      </div>
      {enCurso && <p className="text-xs text-muted-foreground">{sesgoTexto(precision.sesgoPct)}.</p>}
      <p className="text-[11px] text-muted-foreground/80">
        💡 &quot;Pronóstico retrospectivo&quot; es lo que el modelo estimaba para cada {periodo} con solo las ventas previas. Así ves qué tan certero es el forecast en tu negocio.
      </p>
    </div>
  );
}

function sesgoTexto(sesgoPct: number) {
  if (Math.abs(sesgoPct) < 5) return "Estimación equilibrada: sin tendencia a sobredimensionar ni subestimar";
  return sesgoPct > 0
    ? `Tiende a proyectar por encima (${porcentaje(sesgoPct)} por sobre lo vendido)`
    : `Tiende a quedarse corto (${porcentaje(sesgoPct)} por debajo de lo vendido)`;
}

function Dato({ titulo, detalle, children }: { titulo: string; detalle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5 text-xs flex flex-col gap-0.5 border border-border/40">
      <p className="text-muted-foreground font-medium">
        {titulo} <span className="opacity-75">· {detalle}</span>
      </p>
      {children}
    </div>
  );
}
