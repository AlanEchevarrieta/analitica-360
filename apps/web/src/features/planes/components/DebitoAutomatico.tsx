"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { CreditCard } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApiFetch } from "@/hooks/use-api";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { PLANES, type Ciclo, type PlanPagoId } from "../planes";

interface EstadoMercadoPago {
  disponible: boolean;
  suscripcion: { estado: "pending" | "authorized" | "paused" | "cancelled"; plan: PlanPagoId; ciclo: Ciclo; monto: number; urlAutorizar: string | null } | null;
}

const CICLO = { mensual: "mensual", trimestral: "trimestral", anual: "anual" } as const;

export function useMercadoPago() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const estado = useQuery({ queryKey: ["mercadopago", orgId], queryFn: () => api<EstadoMercadoPago>("/suscripcion/mercadopago"), enabled: Boolean(orgId) });
  const activar = useMutation({
    mutationFn: (d: { plan: PlanPagoId; ciclo: Ciclo }) => api<{ url: string }>("/suscripcion/mercadopago", { method: "POST", body: JSON.stringify(d) }),
    // Mercado Pago pide la tarjeta en su página; después vuelve a /planes.
    onSuccess: (r) => window.location.assign(r.url),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo iniciar el pago"),
  });
  const cancelar = useMutation({
    mutationFn: () => api("/suscripcion/mercadopago/cancelar", { method: "POST" }),
    onSuccess: () => {
      toast.success("Débito automático cancelado. Tu plan sigue hasta el final del período pagado.");
      void queryClient.invalidateQueries({ queryKey: ["mercadopago"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cancelar"),
  });
  return { estado, activar, cancelar };
}

/** Botón dentro de cada plan: pagar con débito automático (solo el dueño y si Mercado Pago está configurado). */
export function BotonDebitoAutomatico({ plan, ciclo }: { plan: PlanPagoId; ciclo: Ciclo }) {
  const esDueno = useRol() === "dueno";
  const { estado, activar } = useMercadoPago();
  const s = estado.data?.suscripcion;
  if (!esDueno || !estado.data?.disponible) return null;
  if (s?.estado === "authorized" && s.plan === plan && s.ciclo === ciclo) return <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">Con débito automático</p>;
  if (s?.estado === "authorized") return null;
  return (
    <Button variant="outline" className="w-full" disabled={activar.isPending} onClick={() => activar.mutate({ plan, ciclo })}>
      <CreditCard className="size-4" /> {activar.isPending ? "Abriendo Mercado Pago…" : "Débito automático con Mercado Pago"}
    </Button>
  );
}

/** Arriba de los planes: el estado del débito automático, con su acción. */
export function EstadoDebitoAutomatico() {
  const esDueno = useRol() === "dueno";
  const { estado, cancelar } = useMercadoPago();
  const params = useSearchParams();
  const volvio = params.get("mp") === "volvio";

  useEffect(() => {
    if (volvio) toast.info("Volviste de Mercado Pago. En unos minutos se confirma el pago y tu cuenta queda al día.");
  }, [volvio]);

  const s = estado.data?.suscripcion;
  if (!esDueno || !estado.data?.disponible || !s || s.estado === "cancelled") return null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
      <CreditCard className="size-5 text-primary" />
      <p className="flex-1">
        {s.estado === "authorized" ? (
          <>
            <span className="font-medium">Débito automático activo:</span> plan {PLANES[s.plan].nombre} {CICLO[s.ciclo]}, {formatoPesos(s.monto)} + IVA. Se cobra solo en tu tarjeta.
          </>
        ) : s.estado === "paused" ? (
          <>
            <span className="font-medium">El débito automático está pausado.</span> Revisá tu tarjeta en Mercado Pago.
          </>
        ) : (
          <>
            <span className="font-medium">Falta autorizar tu tarjeta</span> en Mercado Pago para el plan {PLANES[s.plan].nombre} {CICLO[s.ciclo]}.
          </>
        )}
      </p>
      {s.estado === "pending" && s.urlAutorizar && (
        <a href={s.urlAutorizar} className="font-medium text-primary hover:underline">
          Autorizar ahora
        </a>
      )}
      {s.estado !== "pending" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={cancelar.isPending}
          onClick={() => {
            if (window.confirm("¿Cancelar el débito automático? Tu plan sigue hasta el final del período que ya pagaste.")) cancelar.mutate();
          }}
        >
          Cancelar débito
        </Button>
      )}
    </div>
  );
}
