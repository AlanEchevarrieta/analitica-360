"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { PlanPago } from "./use-alianzas";

// Espejo de apps/api modules/planes/precios-plan.service.ts (panel).
export interface PrecioProgramado {
  id: string;
  plan: PlanPago;
  nombre: string;
  precioMensual: number;
  antes: number;
  vigenteDesde: string;
  /** Desde cuándo rige de verdad (se corre si el aviso salió tarde); null = todavía no se avisó. */
  rigeDesde: string | null;
  avisadoEl: string | null;
  avisados: number;
  motivo: string | null;
}

export interface PanelPrecios {
  hoy: string;
  primeraFechaPosible: string;
  actuales: { plan: PlanPago; nombre: string; precioMensual: number }[];
  programados: PrecioProgramado[];
  historial: { id: string; plan: PlanPago; nombre: string; precioMensual: number; rigeDesde: string; motivo: string | null }[];
  ipc: { meses: { mes: string; valor: number }[]; acumulada: number } | null;
  emailConfigurado: boolean;
}

export interface ProgramarAumento {
  vigenteDesde: string;
  porcentaje?: number;
  precios?: Partial<Record<PlanPago, number>>;
  motivo?: string;
}

const RUTA = "/admin/precios";

export function usePanelPrecios() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["admin", "precios", orgId], queryFn: () => api<PanelPrecios>(RUTA), enabled: Boolean(orgId), retry: 1 });
}

export function useAccionesPrecios() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });
  return {
    programar: useMutation({ mutationFn: (d: ProgramarAumento) => api<PanelPrecios>(RUTA, { method: "POST", body: JSON.stringify(d) }), onSuccess: refrescar }),
    cancelar: useMutation({ mutationFn: (id: string) => api<PanelPrecios>(`${RUTA}/${id}`, { method: "DELETE" }), onSuccess: refrescar }),
    avisar: useMutation({ mutationFn: () => api<{ enviados: number }>(`${RUTA}/avisar`, { method: "POST" }), onSuccess: refrescar }),
  };
}
