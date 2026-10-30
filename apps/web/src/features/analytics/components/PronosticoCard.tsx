"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoMoneda } from "@/lib/formato";
import { etiquetaFecha } from "@/lib/periodos";
import type { InsightForecast } from "../types";

const GRAFICO_PRONOSTICO = {
  historico: { label: "Real", color: "var(--chart-1)" },
  pronosticado: { label: "Pronosticado", color: "var(--chart-3)" },
  proyeccion: { label: "Proyección", color: "var(--chart-3)" },
  realEnCurso: { label: "En curso", color: "var(--chart-1)" },
} satisfies ChartConfig;

const TENDENCIA = { positiva: "📈 en alza", negativa: "📉 en baja", neutra: "➡️ estable" } as const;

type Granularidad = "semana" | "mes";

/** Qué tan confiable es el pronóstico según cuánto le viene errando (error sobre lo vendido). */
function calificar(errorPct: number) {
  if (errorPct < 15) return { texto: "Bastante certero", clase: "text-emerald-600" };
  if (errorPct < 30) return { texto: "Orientativo", clase: "text-amber-600" };
  return { texto: "Poco confiable: tus ventas varían mucho", clase: "text-red-600" };
}

const porcentaje = (n: number) => `${Math.abs(n).toFixed(0)} %`;

interface Props {
  forecast: InsightForecast | null;
  error?: string;
  pronostico: Granularidad;
  onPronostico: (g: Granularidad) => void;
}

export function PronosticoCard({ forecast, error, pronostico, onPronostico }: Props) {
  const periodo = pronostico === "semana" ? "semana" : "mes";
  const etiquetaPeriodo = (l: string) => (pronostico === "semana" ? `Semana del ${etiquetaFecha(l)}` : etiquetaFecha(l.slice(0, 7)));
  const primerFuturo = forecast?.puntos.find((p) => p.historico == null)?.clave;

  return (
    <Card>
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
        <CardContent className="flex flex-col gap-3">
          <div className="h-64">
            <ChartContainer config={GRAFICO_PRONOSTICO} className="aspect-auto h-full w-full">
              <LineChart data={forecast.puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="clave" tickFormatter={etiquetaFecha} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v: number) => formatoMoneda(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoMoneda(Number(v))} labelFormatter={(l) => etiquetaPeriodo(String(l))} />} />
                {primerFuturo && <ReferenceLine x={primerFuturo} stroke="var(--border)" strokeDasharray="3 3" label={{ value: "Hoy", position: "insideTopLeft", fontSize: 11, fill: "var(--muted-foreground)" }} />}
                <Line dataKey="historico" stroke="var(--color-historico)" strokeWidth={2} dot={false} connectNulls={false} />
                <Line dataKey="pronosticado" stroke="var(--color-pronosticado)" strokeDasharray="2 3" strokeWidth={1.5} dot={{ r: 2 }} connectNulls={false} />
                <Line dataKey="proyeccion" stroke="var(--color-proyeccion)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line dataKey="realEnCurso" stroke="none" dot={{ r: 4, fill: "var(--color-realEnCurso)" }} legendType="circle" isAnimationActive={false} />
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

function PrecisionPronostico({ forecast, periodo, etiquetaPeriodo }: { forecast: InsightForecast; periodo: string; etiquetaPeriodo: (l: string) => string }) {
  const { precision, enCurso } = forecast;
  if (!precision) {
    return <p className="text-xs text-muted-foreground">Para comparar el pronóstico con lo real hacen falta al menos 5 {periodo === "semana" ? "semanas" : "meses"} de ventas.</p>;
  }
  const { ultimo } = precision;
  const nota = calificar(precision.errorPct);
  const vendioMas = ultimo.diferencia < 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
        <Dato titulo={`Último ${periodo} cerrado`} detalle={etiquetaPeriodo(ultimo.clave)}>
          <p className="tabular-nums">
            Pronóstico {formatoMoneda(ultimo.pronosticado)} · Real {formatoMoneda(ultimo.real)}
          </p>
          <p className="font-medium tabular-nums">
            Le erró por {formatoMoneda(Math.abs(ultimo.diferencia))}
            {ultimo.diferenciaPct != null && ` (${porcentaje(ultimo.diferenciaPct)})`}: vendiste {vendioMas ? "más" : "menos"} de lo esperado
          </p>
        </Dato>
        <Dato titulo="Error promedio" detalle={`últimos ${precision.periodos} ${periodo === "semana" ? "semanas" : "meses"}`}>
          <p className="font-medium tabular-nums">
            ± {porcentaje(precision.errorPct)} · {formatoMoneda(precision.errorPromedio)} por {periodo}
          </p>
          <p className={nota.clase}>{nota.texto}</p>
        </Dato>
        {enCurso ? (
          <Dato titulo={`Este ${periodo}, hasta hoy`} detalle="todavía no terminó">
            <p className="tabular-nums">
              Van {formatoMoneda(enCurso.real)} de {formatoMoneda(enCurso.pronosticado)}
            </p>
            <p className="font-medium tabular-nums">{enCurso.pronosticado > 0 ? `${((enCurso.real / enCurso.pronosticado) * 100).toFixed(0)} % de lo pronosticado` : "Sin pronóstico para comparar"}</p>
          </Dato>
        ) : (
          <Dato titulo="Hacia dónde le erra" detalle={`últimos ${precision.periodos} ${periodo === "semana" ? "semanas" : "meses"}`}>
            <p className="font-medium">{sesgoTexto(precision.sesgoPct)}</p>
          </Dato>
        )}
      </div>
      {enCurso && <p className="text-xs text-muted-foreground">{sesgoTexto(precision.sesgoPct)}.</p>}
      <p className="text-xs text-muted-foreground">
        &quot;Pronosticado&quot; es lo que el pronóstico decía de cada {periodo} con las ventas de antes. Así se ve cuánto le viene errando.
      </p>
    </div>
  );
}

function sesgoTexto(sesgoPct: number) {
  if (Math.abs(sesgoPct) < 5) return "No tiende a errarle para un lado: a veces de más, a veces de menos";
  return sesgoPct > 0 ? `Suele pronosticar de más (${porcentaje(sesgoPct)} por encima de lo vendido)` : `Suele quedarse corto (${porcentaje(sesgoPct)} por debajo de lo vendido)`;
}

function Dato({ titulo, detalle, children }: { titulo: string; detalle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/50 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {titulo} · {detalle}
      </p>
      {children}
    </div>
  );
}
