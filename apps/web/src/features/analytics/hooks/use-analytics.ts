"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { paramMoneda, useMoneda } from "@/lib/moneda";
import type { Contabilidad, EstadosContables, Gasto, Inflacion, Insights, Combo, MovimientoFinanciero, Periodo, TipoMovimientoFinanciero } from "../types";

/** `conMoneda`: el reporte se puede ver en dólares (botón $ / US$). */
function useConsulta<T>(clave: unknown[], ruta: string | null, conMoneda = false) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const moneda = useMoneda();
  const m = conMoneda ? moneda : "ARS";
  return useQuery({
    queryKey: [...clave, orgId, m],
    queryFn: () => api<T>(`${ruta!}${paramMoneda(m)}`),
    enabled: Boolean(orgId && ruta),
    // Mientras carga se muestra lo anterior, pero nunca pesos con el signo de dólar (ni al revés).
    placeholderData: (anterior, consulta) => (consulta?.queryKey.at(-1) === m ? keepPreviousData(anterior) : undefined),
  });
}

export const usePeriodo = (desde: string, hasta: string, granularidad: "dia" | "semana" | "mes" | "anio") =>
  useConsulta<{ avisoLimite: number | null; data: Periodo | null }>(
    ["periodo", desde, hasta, granularidad],
    `/analytics/periodo?desde=${desde}&hasta=${hasta}&granularidad=${granularidad}`,
    true,
  );

export interface FilaRendimiento {
  clave: string;
  nombre: string;
  ventas: number;
  total: number;
  pct: number;
  ticket: number;
  totalAnterior: number;
  variacion: number | null;
}
/** Ventas por stand y por vendedor (participación, ticket promedio, variación). */
export const useRendimiento = (desde: string, hasta: string) =>
  useConsulta<{ periodoAnterior: { desde: string; hasta: string }; porUbicacion: FilaRendimiento[]; porVendedor: FilaRendimiento[] }>(
    ["rendimiento", desde, hasta],
    `/analytics/rendimiento?desde=${desde}&hasta=${hasta}`,
    true,
  );

export const useContabilidad = (desde: string, hasta: string) =>
  useConsulta<Contabilidad>(["contabilidad", desde, hasta], `/contabilidad?desde=${desde}&hasta=${hasta}`, true);

export const useGastos = (desde: string, hasta: string) =>
  useConsulta<Gasto[]>(["gastos", desde, hasta], `/gastos?desde=${desde}&hasta=${hasta}`);

/** Insights usa todo el historial; solo se elige cómo agrupar el pronóstico. */
export const useInsights = (pronostico: "semana" | "mes") =>
  useConsulta<Insights>(["insights", pronostico], `/analytics/insights?pronostico=${pronostico}`);

/** Productos que se compran juntos (de a 2 o de a 3), con todo el historial. */
export const useCombos = (tamano: 2 | 3) =>
  useConsulta<Combo[]>(["combos", tamano], tamano === 2 ? "/analytics/insights/combos" : "/analytics/insights/combos-3");

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
