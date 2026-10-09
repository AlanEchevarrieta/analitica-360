"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiFetch } from "@/hooks/use-api";
import { useAcceso } from "@/hooks/use-acceso";
import { usePlan } from "@/hooks/use-plan";
import { formatoMoneda } from "@/lib/formato";
import { useMoneda } from "@/lib/moneda";
import { cn } from "@/lib/utils";
import { CATEGORIAS_GASTO } from "@/features/analytics/components/GastosPanel";

interface Equilibrio {
  desde: string;
  hasta: string;
  fijos: number;
  variablesPct: number;
  mercaderiaPct: number;
  gastosVariablesPct: number;
  contribucionPct: number;
  puntoEquilibrio: number | null;
  ventas: number;
  falta: number;
  porcentaje: number | null;
  esperado: number;
  diaQueCubre: string | null;
  ventaDiariaNecesaria: number | null;
  cubierto: boolean;
  fijosPorCategoria: { categoria: string; monto: number }[];
  hayGastos: boolean;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pct = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })} %`;

function useEquilibrio(habilitado: boolean) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const moneda = useMoneda();
  return useQuery({
    queryKey: ["equilibrio", orgId, moneda],
    queryFn: () => api<Equilibrio>(moneda === "USD" ? "/contabilidad/equilibrio?moneda=USD" : "/contabilidad/equilibrio"),
    enabled: Boolean(orgId) && habilitado,
  });
}

/** Inicio: cuánto hay que vender este mes para cubrir los costos (punto de equilibrio). */
export function EquilibrioInicio() {
  const { disponible } = usePlan();
  const { puede } = useAcceso();
  const habilitado = disponible("contabilidad") && puede("contabilidad");
  const { data: e } = useEquilibrio(habilitado);
  if (!habilitado || !e) return null;
  const mes = MESES[Number(e.desde.slice(5, 7)) - 1];

  if (!e.hayGastos || e.fijos === 0) {
    return (
      <Card className="h-full py-4">
        <CardContent className="flex h-full flex-wrap items-center gap-3 px-4">
          <Scale className="size-5 text-primary" />
          <p className="flex-1 text-sm">
            <span className="font-medium">¿Cuánto tenés que vender para no perder plata?</span> Cargá tus costos fijos (alquiler, sueldos, servicios) y te lo calculamos cada mes.
          </p>
          <Link prefetch={false} href="/analytics/contabilidad" className="text-sm font-medium text-primary hover:underline">
            Cargar gastos →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const tono = e.cubierto ? "bien" : e.diaQueCubre ? "justo" : "mal";
  const chip = { bien: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", justo: "bg-amber-500/15 text-amber-600 dark:text-amber-400", mal: "bg-red-500/15 text-red-600 dark:text-red-400" }[tono];
  const barra = { bien: "bg-emerald-500", justo: "bg-amber-500", mal: "bg-red-500" }[tono];
  const quedan = Math.round(e.contribucionPct);

  return (
    <Card className="h-full gap-3 py-4">
      <CardContent className="flex h-full flex-col gap-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Scale className="size-4 text-primary" /> Punto de equilibrio · {mes}
          </p>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", chip)}>{e.cubierto ? "¡Costos cubiertos!" : `Faltan ${formatoMoneda(e.falta)}`}</span>
        </div>

        {e.puntoEquilibrio == null ? (
          <p className="text-sm">Con el margen actual, cada venta cuesta más de lo que deja: revisá precios o costos.</p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{formatoMoneda(e.ventas)}</span> <span className="text-muted-foreground">vendidos de</span>{" "}
              <span className="font-semibold tabular-nums">{formatoMoneda(e.puntoEquilibrio)}</span> <span className="text-muted-foreground">para no perder plata</span>
            </p>
            <div className="relative h-2.5 rounded-full bg-foreground/10" role="progressbar" aria-valuenow={e.porcentaje ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Avance hacia el punto de equilibrio">
              <div className={cn("h-full rounded-full", barra)} style={{ width: `${Math.min(100, e.porcentaje ?? 0)}%` }} />
              {e.esperado < 100 && <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/60" style={{ left: `${e.esperado}%` }} title={`Para hoy: ${pct(e.esperado)}`} />}
            </div>
            <p className="text-sm text-muted-foreground">
              {e.cubierto
                ? `Desde acá, de cada $100 que vendés, $${quedan} son ganancia.`
                : `${e.diaQueCubre ? `A este ritmo cubrís los costos el ${Number(e.diaQueCubre.slice(8))} de ${mes}.` : "A este ritmo no llegás a cubrirlos este mes."}${e.ventaDiariaNecesaria ? ` Vendé ${formatoMoneda(e.ventaDiariaNecesaria)} por día para llegar.` : ""}`}
            </p>
          </>
        )}

        <details className="group mt-auto text-sm">
          <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">
            Ver detalle <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Costos fijos del mes</p>
              <p className="font-semibold tabular-nums">{formatoMoneda(e.fijos)}</p>
              <p className="text-xs text-muted-foreground">{e.fijosPorCategoria.slice(0, 3).map((f) => CATEGORIAS_GASTO[f.categoria] ?? f.categoria).join(", ")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costos variables</p>
              <p className="font-semibold tabular-nums">{pct(e.variablesPct)} de cada venta</p>
              <p className="text-xs text-muted-foreground">
                Mercadería {pct(e.mercaderiaPct)} + gastos {pct(e.gastosVariablesPct)}. De cada $100 te quedan ${quedan} para los fijos.
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Los % salen de los últimos 3 meses. Los gastos se marcan como fijos o variables en Analytics → Contabilidad.</p>
        </details>
      </CardContent>
    </Card>
  );
}
