"use client";

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { useSuscripcion } from "@/hooks/use-suscripcion";
import { cn } from "@/lib/utils";

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/** El día anterior a `iso` (AAAA-MM-DD): último día con el plan completo. */
function diaAnterior(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Aviso fijo arriba de cada pantalla: prueba por terminar, plan vencido en
 * gracia o cuenta en solo lectura (la API rechaza cargar datos; ver SuscripcionGuard).
 */
export function AvisoCuenta() {
  const { data } = useSuscripcion();
  // Sin `acceso` (API anterior a este cambio): no se muestra nada.
  if (!data?.acceso) return null;
  const { acceso } = data;

  let grave = false;
  let texto: string | null = null;
  if (acceso.nivel === "solo_lectura") {
    grave = true;
    texto =
      acceso.motivo === "prueba_vencida"
        ? "Tu prueba gratis terminó. Podés ver tus datos, pero para cargar ventas, compras o productos (y descargar tus datos) contratá un plan."
        : "Tu plan venció. Podés ver y descargar tus datos, pero para cargar ventas, compras o productos renová tu plan.";
  } else if (acceso.nivel === "gracia" && acceso.bloqueoDesde) {
    texto = `Tu plan venció. Renovalo antes del ${fechaCorta(diaAnterior(acceso.bloqueoDesde))} inclusive para no perder la carga de datos.`;
  } else if (data.enTrial && data.diasRestantes <= 3) {
    texto =
      data.diasRestantes === 1
        ? "Hoy es el último día de tu prueba gratis. Elegí un plan para seguir cargando datos."
        : `Te quedan ${data.diasRestantes} días de prueba gratis. Elegí un plan para seguir cargando datos.`;
  }
  if (!texto) return null;

  const Icono = grave ? AlertTriangle : Clock;
  return (
    <div
      role={grave ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-xl p-4 text-sm ring-1 sm:flex-row sm:items-center print:hidden",
        grave ? "bg-destructive/10 ring-destructive/30" : "bg-amber-500/10 ring-amber-500/30",
      )}
    >
      <Icono className={cn("size-5 shrink-0", grave ? "text-destructive" : "text-amber-600")} aria-hidden />
      <p className="flex-1">{texto}</p>
      <div className="flex shrink-0 gap-2">
        <Link href="/planes" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Ver planes
        </Link>
        {grave ? (
          <Link href="/soporte/nuevo" className="rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-border hover:bg-muted">
            Pedir ayuda
          </Link>
        ) : null}
      </div>
    </div>
  );
}
