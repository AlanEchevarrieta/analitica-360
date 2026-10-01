"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "./use-api";

export interface SuscripcionActiva {
  id: string;
  estado: string;
  fechaVencimiento: string | null;
  planNombre?: string | null;
}

/** Qué puede hacer la empresa hoy (apps/api modules/planes/acceso-cuenta.util.ts). */
export interface AccesoCuenta {
  nivel: "activo" | "gracia" | "solo_lectura";
  motivo: "prueba_vencida" | "plan_vencido" | null;
  puedeExportar: boolean;
  /** AAAA-MM-DD en que pasa a solo lectura (solo en gracia). */
  bloqueoDesde: string | null;
}

export interface EstadoSuscripcionRespuesta {
  suscripcion: SuscripcionActiva | null;
  diasRestantes: number;
  enTrial: boolean;
  trialVencido: boolean;
  acceso: AccesoCuenta;
}

/** GET /suscripcion (ver apps/api modules/planes/suscripcion.controller.ts). */
export function useSuscripcion() {
  const api = useApiFetch();
  const { isSignedIn, orgId } = useAuth();
  return useQuery({
    queryKey: ["suscripcion", orgId],
    queryFn: () => api<EstadoSuscripcionRespuesta>("/suscripcion"),
    enabled: Boolean(isSignedIn && orgId),
    staleTime: 60_000,
  });
}

/** Con la prueba gratis vencida no se pueden descargar datos (la API igual lo rechaza). */
export function usePuedeExportar(): boolean {
  const { data } = useSuscripcion();
  return data?.acceso?.puedeExportar ?? true;
}
