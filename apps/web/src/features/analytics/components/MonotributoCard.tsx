"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, Info } from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiFetch } from "@/hooks/use-api";
import { formatoPesos } from "@/lib/formato";
import { etiquetaGranularidad } from "@/lib/periodos";
import { cn } from "@/lib/utils";

type Alerta = "exclusion" | "supera_categoria" | "cerca_tope" | "puede_bajar" | "sin_categoria" | "topes_desactualizados";

export interface Monotributo {
  condicionFiscal: string;
  vigenciaTopes: string | null;
  topes: { categoria: string; topeAnual: number }[];
  meses: { mes: string; ingresos: number }[];
  estado: {
    ingresos12m: number;
    categoriaSegunIngresos: string | null;
    categoriaActual: string | null;
    topeActual: number | null;
    usoPct: number | null;
    margenDisponible: number | null;
    ritmoMensual: number;
    proyeccionAnual: number;
    categoriaProyectada: string | null;
    proximaRecategorizacion: { mes: string; desde: string; hasta: string };
    alertas: Alerta[];
  } | null;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLargo = (clave: string) => `${MESES[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}`;
const G_MESES = { ingresos: { label: "Facturado", color: "var(--chart-1)" } } satisfies ChartConfig;

export function useMonotributo() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["monotributo", orgId], queryFn: () => api<Monotributo>("/monotributo"), enabled: Boolean(orgId), retry: false, staleTime: 5 * 60_000 });
}

/** Mensajes para el dueño, del más urgente al informativo. */
function mensajes(m: Monotributo): { texto: string; grave: boolean }[] {
  const e = m.estado!;
  const recat = mesLargo(e.proximaRecategorizacion.mes);
  const out: { texto: string; grave: boolean }[] = [];
  for (const a of e.alertas) {
    if (a === "exclusion") out.push({ grave: true, texto: "Tus ingresos de los últimos 12 meses superan la categoría más alta: riesgo de quedar excluido del monotributo. Hablá con tu contador cuanto antes." });
    if (a === "supera_categoria") out.push({ grave: true, texto: `Ya superaste el tope de la categoría ${e.categoriaActual}: en la recategorización de ${recat} te corresponde la ${e.categoriaSegunIngresos}.` });
    if (a === "cerca_tope") out.push({ grave: true, texto: `Ya facturaste el ${e.usoPct?.toLocaleString("es-AR")}% del tope de tu categoría. Te quedan ${formatoPesos(e.margenDisponible)} antes de pasarte.` });
    if (a === "puede_bajar") out.push({ grave: false, texto: `Con lo que facturaste en 12 meses te alcanza la categoría ${e.categoriaSegunIngresos}, que es más barata. Consultalo con tu contador en la recategorización de ${recat}.` });
    if (a === "sin_categoria") out.push({ grave: false, texto: `Cargá tu categoría en Configuración → Configuración fiscal para ver cuánto margen te queda.${e.categoriaSegunIngresos ? ` Por tus ingresos correspondería la ${e.categoriaSegunIngresos}.` : ""}` });
    if (a === "topes_desactualizados") out.push({ grave: false, texto: `Los topes cargados rigen desde ${m.vigenciaTopes ? mesLargo(m.vigenciaTopes.slice(0, 7)) : "—"}: ARCA los actualiza en febrero y agosto, pueden estar desactualizados.` });
  }
  return out;
}

/** Aviso compacto para Inicio: solo si hay algo importante (tope cerca, superado o exclusión). */
export function AvisoMonotributo() {
  const { data } = useMonotributo();
  if (!data?.estado) return null;
  const graves = mensajes(data).filter((x) => x.grave);
  if (graves.length === 0) return null;
  return (
    <Link href="/analytics/contabilidad" className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm ring-1 ring-amber-500/30 hover:bg-amber-500/15">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
      <span>
        <b>Monotributo:</b> {graves[0].texto} <span className="underline">Ver detalle</span>
      </span>
    </Link>
  );
}

export function MonotributoCard() {
  const { data, isPending, isError } = useMonotributo();
  if (isPending || isError || !data) return null;
  if (!data.estado) return null; // responsable inscripto u otra condición: no aplica
  const e = data.estado;
  const tope = e.topeActual ?? data.topes.find((t) => t.categoria === e.categoriaSegunIngresos)?.topeAnual ?? null;
  const pct = tope ? Math.min(100, (e.ingresos12m / tope) * 100) : 0;
  const lista = mensajes(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monotributo{e.categoriaActual ? ` · categoría ${e.categoriaActual}` : ""}</CardTitle>
        <CardDescription>
          Facturación de los últimos 12 meses contra el tope de la categoría. Próxima recategorización: {mesLargo(e.proximaRecategorizacion.mes)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tabular-nums">{formatoPesos(e.ingresos12m)}</span>
            {tope && (
              <span className="text-sm text-muted-foreground">
                de {formatoPesos(tope)} {e.categoriaActual ? `(tope de la ${e.categoriaActual})` : `(tope de la ${e.categoriaSegunIngresos}, la que te correspondería)`}
              </span>
            )}
          </div>
          {tope && (
            <div className="relative h-3 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Uso del tope">
              <div className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
              <div className="absolute inset-y-0 left-[80%] w-px bg-foreground/40" title="80% del tope" />
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Al ritmo de los últimos 3 meses ({formatoPesos(e.ritmoMensual)} por mes) facturarías {formatoPesos(e.proyeccionAnual)} en un año
            {e.categoriaProyectada ? `: categoría ${e.categoriaProyectada}.` : ": más que la categoría más alta."}
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {lista.map((x) => (
              <li key={x.texto} className={cn("flex items-start gap-2", x.grave ? "" : "text-muted-foreground")}>
                {x.grave ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {x.texto}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Se calcula con las ventas registradas en la app (netas de devoluciones). Es una ayuda: confirmá tu categoría con tu contador.
          </p>
        </div>
        <div className="h-40">
          <ChartContainer config={G_MESES} className="aspect-auto h-full w-full">
            <BarChart data={data.meses} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="mes" tickFormatter={(m: string) => etiquetaGranularidad(m, "mes").split(" ")[0]} tickLine={false} axisLine={false} fontSize={11} interval={1} />
              <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatoPesos(Number(v))} labelFormatter={(l) => etiquetaGranularidad(String(l), "mes")} />} />
              <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
