"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { FiltrosVentas, ListaVentas } from "../types";

export const VENTAS_POR_PAGINA = 25;

/** GET /ventas (VentasController). El rango de fechas solo se aplica si vienen desde y hasta. */
export function useVentas(filtros: FiltrosVentas) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const params = new URLSearchParams({ pagina: String(filtros.pagina), pageSize: String(VENTAS_POR_PAGINA) });
  if (filtros.desde && filtros.hasta) {
    params.set("desde", filtros.desde);
    params.set("hasta", filtros.hasta);
  }
  if (filtros.cliente.trim()) params.set("cliente", filtros.cliente.trim());
  // Sin mostrarAnuladas: por defecto la API excluye las anuladas.

  return useQuery({
    queryKey: ["ventas", orgId, filtros],
    queryFn: () => api<ListaVentas>(`/ventas?${params}`),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}
