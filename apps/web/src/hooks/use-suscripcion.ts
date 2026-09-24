"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "./use-api";

export interface SuscripcionActiva {
  id: string;
  estado: string;
  fechaVencimiento: string | null;
}

export interface EstadoSuscripcionRespuesta {
  suscripcion: SuscripcionActiva | null;
  diasRestantes: number;
  enTrial: boolean;
  trialVencido: boolean;
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
