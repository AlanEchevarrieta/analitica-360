"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { VarianteProducto } from "../types";

/** GET /productos/:id/variantes — se pide al elegir el producto, no para todo el catálogo. */
export function useVariantes() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();
  return (productoId: string) =>
    queryClient.fetchQuery({
      queryKey: ["variantes", orgId, productoId],
      queryFn: () => api<VarianteProducto[]>(`/productos/${productoId}/variantes`),
      staleTime: 60_000,
    });
}
