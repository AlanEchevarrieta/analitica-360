"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { Ciclo, PlanPagoId } from "./planes";

// Espejo de GET /suscripcion/precios (apps/api modules/alianzas).
export interface PrecioCiclo {
  ciclo: Ciclo;
  meses: number;
  lista: number;
  primerPago: { tipo: "entrada" | "renovacion"; total: number; descuento: number; cuotas: number; montoCuota: number };
  renovacion: { total: number; descuento: number };
}

export interface TablaPrecios {
  cupon: { codigo: string; camara: string | null; aplicado: boolean; diasPrueba: number | null } | null;
  aviso: string | null;
  planes: { plan: PlanPagoId; nombre: string; ciclos: PrecioCiclo[] }[];
}

/** Precios para la empresa: con su código, o con el que está probando (`codigo`). */
export function usePrecios(codigo: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["precios", orgId, codigo],
    queryFn: () => api<TablaPrecios>(`/suscripcion/precios${codigo ? `?codigo=${encodeURIComponent(codigo)}` : ""}`),
    enabled: Boolean(orgId),
    placeholderData: (previo) => previo,
  });
}

export function useAplicarCodigo() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => api<{ codigo: string; camara: string | null; pruebaHasta: string | null; mensaje: string }>("/suscripcion/codigo", { method: "POST", body: JSON.stringify({ codigo }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["precios"] });
      void queryClient.invalidateQueries({ queryKey: ["suscripcion"] });
    },
  });
}
