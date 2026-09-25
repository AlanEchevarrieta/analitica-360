"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { FiltrosProductos, ListaProductos } from "../types";

/** GET /productos (ProductosController): incluye el stock actual de cada producto. */
export function useProductos(filtros: FiltrosProductos) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const params = new URLSearchParams({
    pagina: String(filtros.pagina),
    pageSize: String(filtros.pageSize),
    estado: filtros.estado,
  });
  if (filtros.busqueda.trim()) params.set("busqueda", filtros.busqueda.trim());

  return useQuery({
    queryKey: ["productos", orgId, filtros],
    queryFn: () => api<ListaProductos>(`/productos?${params}`),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}
