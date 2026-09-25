"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { Contabilidad, Gasto, Inflacion, Insights, Combo, Periodo } from "../types";

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
    for (const k of ["gastos", "contabilidad"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const crear = useMutation({
    mutationFn: (g: { categoria: string; descripcion: string; monto: number; fecha: string; recurrente: boolean; frecuencia: string | null }) =>
      api("/gastos", { method: "POST", body: JSON.stringify(g) }),
    onSuccess,
  });
  const anular = useMutation({ mutationFn: (id: string) => api(`/gastos/${id}/anular`, { method: "POST" }), onSuccess });
  return { crear, anular };
}
