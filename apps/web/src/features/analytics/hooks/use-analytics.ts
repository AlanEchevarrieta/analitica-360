"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { Contabilidad, EstadosContables, Gasto, Inflacion, Insights, Combo, MovimientoFinanciero, Periodo, TipoMovimientoFinanciero } from "../types";

function useConsulta<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: [...clave, orgId],
    queryFn: () => api<T>(ruta!),
    enabled: Boolean(orgId && ruta),
    placeholderData: keepPreviousData,
  });
}

export const usePeriodo = (desde: string, hasta: string, granularidad: "dia" | "semana" | "mes") =>
  useConsulta<{ avisoLimite: number | null; data: Periodo | null }>(
    ["periodo", desde, hasta, granularidad],
    `/analytics/periodo?desde=${desde}&hasta=${hasta}&granularidad=${granularidad}`,
  );

export const useContabilidad = (desde: string, hasta: string) =>
  useConsulta<Contabilidad>(["contabilidad", desde, hasta], `/contabilidad?desde=${desde}&hasta=${hasta}`);

export const useGastos = (desde: string, hasta: string) =>
  useConsulta<Gasto[]>(["gastos", desde, hasta], `/gastos?desde=${desde}&hasta=${hasta}`);

export const useInsights = (desde: string, hasta: string) =>
  useConsulta<Insights>(["insights", desde, hasta], `/analytics/insights?desde=${desde}&hasta=${hasta}`);

export const useCombos = (desde: string, hasta: string) =>
  useConsulta<Combo[]>(["combos", desde, hasta], `/analytics/insights/combos?desde=${desde}&hasta=${hasta}`);

export const useInflacion = (desde: string, hasta: string) =>
  useConsulta<Inflacion>(["inflacion", desde, hasta], `/analytics/inflacion?desde=${desde}&hasta=${hasta}`);

export function useAccionesGastos() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSuccess = () => {
    for (const k of ["gastos", "contabilidad", "estados-contables"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const crear = useMutation({
    mutationFn: (g: { categoria: string; descripcion: string; monto: number; fecha: string; recurrente: boolean; frecuencia: string | null }) =>
      api("/gastos", { method: "POST", body: JSON.stringify(g) }),
    onSuccess,
  });
  const anular = useMutation({ mutationFn: (id: string) => api(`/gastos/${id}/anular`, { method: "POST" }), onSuccess });
  return { crear, anular };
}

export const useEstadosContables = (desde: string, hasta: string) =>
  useConsulta<EstadosContables>(["estados-contables", desde, hasta], `/estados-contables?desde=${desde}&hasta=${hasta}`);

export const useMovimientosFinancieros = (desde: string, hasta: string) =>
  useConsulta<MovimientoFinanciero[]>(["movimientos-financieros", desde, hasta], `/movimientos-financieros?desde=${desde}&hasta=${hasta}`);

export interface NuevoMovimientoFinanciero {
  tipo: TipoMovimientoFinanciero;
  monto: number;
  fecha: string;
  descripcion: string;
  proveedorId: string | null;
  vidaUtilMeses: number | null;
  conCaja: boolean;
}

export function useAccionesMovimientos() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSuccess = () => {
    for (const k of ["movimientos-financieros", "estados-contables"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const crear = useMutation({
    mutationFn: (m: NuevoMovimientoFinanciero) => api<MovimientoFinanciero>("/movimientos-financieros", { method: "POST", body: JSON.stringify(m) }),
    onSuccess,
  });
  const anular = useMutation({ mutationFn: (id: string) => api(`/movimientos-financieros/${id}/anular`, { method: "POST" }), onSuccess });
  return { crear, anular };
}
