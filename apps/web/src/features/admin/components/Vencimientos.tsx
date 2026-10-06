"use client";

import Link from "next/link";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { cn } from "@/lib/utils";
import { useVencimientosAdmin, type VencimientoAdmin } from "../hooks/use-admin";
import { Panel } from "./comunes";

const SEMAFORO: Record<VencimientoAdmin["estado"], { punto: string; texto: string }> = {
  ok: { punto: "bg-emerald-500", texto: "Al día" },
  aviso: { punto: "bg-amber-400", texto: "Revisar" },
  vencido: { punto: "bg-red-500", texto: "Vencido" },
};

/** Datos que vencen (dólar, topes del monotributo): semáforo y qué hacer. */
export function VencimientosPanel() {
  const { data, isPending, isError, error, refetch } = useVencimientosAdmin();
  return (
    <Panel titulo="Vencimientos" descripcion="Datos que tienen que estar al día. Si algo se vence, también llega un email a los administradores.">
      {isPending ? (
        <CargandoFilas filas={2} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {data.map((v) => (
            <li key={v.clave} className="flex gap-3">
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", SEMAFORO[v.estado].punto)} aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {v.titulo} · <span className="font-normal text-muted-foreground">{SEMAFORO[v.estado].texto}</span>
                </span>
                <span className="text-muted-foreground">{v.detalle}</span>
                {v.queHacer && <span>Qué hacer: {v.queHacer}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Aviso arriba del resumen de la consola, solo si algo no está al día. */
export function AvisoVencimientos() {
  const { data } = useVencimientosAdmin();
  const pendientes = data?.filter((v) => v.estado !== "ok") ?? [];
  if (pendientes.length === 0) return null;
  const grave = pendientes.some((v) => v.estado === "vencido");
  return (
    <Link
      prefetch={false}
      href="/admin/sistema"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm hover:bg-muted/40",
        grave ? "border-red-500/40 bg-red-500/10" : "border-amber-400/40 bg-amber-400/10",
      )}
    >
      <span className="font-medium">{grave ? "Hay datos vencidos" : "Hay datos para revisar"}:</span> {pendientes.map((v) => v.titulo).join(" y ")}. Ver en Sistema →
    </Link>
  );
}
