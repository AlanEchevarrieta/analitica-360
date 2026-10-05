"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { formatoPesos } from "@/lib/formato";
import { cambiarMoneda, useMoneda, type Moneda } from "@/lib/moneda";
import { cn } from "@/lib/utils";

const NOMBRE_DOLAR: Record<string, string> = { blue: "blue", oficial: "oficial", bolsa: "MEP" };

/** Espejo de GET /cotizaciones/hoy (apps/api modules/cotizaciones). */
interface DolarHoy {
  casa: string;
  venta: number | null;
  fecha: string | null;
}

/**
 * Botón $ / US$ del Inicio y de Analytics: en dólares, cada venta se pasa con el
 * dólar del día en que se hizo (el que eligió la empresa en Configuración fiscal).
 * `soloPesos`: la sección no se puede ver en dólares (estados contables, libro diario…).
 */
export function SelectorMoneda({ soloPesos = false }: { soloPesos?: boolean }) {
  const moneda = useMoneda();
  const api = useApiFetch();
  const { orgId } = useAuth();
  const usd = moneda === "USD" && !soloPesos;
  const dolar = useQuery({ queryKey: ["dolar-hoy", orgId], queryFn: () => api<DolarHoy>("/cotizaciones/hoy"), enabled: Boolean(orgId) && usd, staleTime: 10 * 60_000 });
  const opcion = (m: Moneda, texto: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={moneda === m}
      disabled={soloPesos}
      onClick={() => cambiarMoneda(m)}
      className={cn("rounded-md px-2.5 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed", moneda === m && !soloPesos ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {texto}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Moneda de los reportes" className="inline-flex rounded-lg bg-muted p-0.5">
        {opcion("ARS", "$")}
        {opcion("USD", "US$")}
      </div>
      {soloPesos && moneda === "USD" ? (
        <span className="text-xs text-muted-foreground">Esta sección se ve en pesos</span>
      ) : usd && dolar.data ? (
        <span className="text-xs text-muted-foreground">
          Dólar {NOMBRE_DOLAR[dolar.data.casa] ?? dolar.data.casa} del día de cada venta
          {dolar.data.venta ? ` · hoy ${formatoPesos(dolar.data.venta)}` : ""} ·{" "}
          <Link href="/configuracion?s=fiscal" className="underline">
            cambiar
          </Link>
        </span>
      ) : null}
    </div>
  );
}
