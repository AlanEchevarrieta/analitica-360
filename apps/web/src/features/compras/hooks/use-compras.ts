"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { CompraFila, ConfirmarCompraInput, ListaCompras, ProveedorFila } from "../types";

export const COMPRAS_POR_PAGINA = 25;

/** GET /compras (sin anuladas: mostrarAnuladas no se manda, el backend usa z.coerce.boolean). */
export function useCompras(pagina: number, proveedor: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const params = new URLSearchParams({ pagina: String(pagina), pageSize: String(COMPRAS_POR_PAGINA) });
  if (proveedor.trim()) params.set("proveedor", proveedor.trim());
  return useQuery({
    queryKey: ["compras", orgId, pagina, proveedor],
    queryFn: () => api<ListaCompras>(`/compras?${params}`),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}

export function useProveedores() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["proveedores", orgId],
    queryFn: async () => (await api<{ items: ProveedorFila[] }>("/proveedores?pagina=1&pageSize=200")).items,
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
}

/** POST /compras: suma stock y actualiza el costo promedio ponderado de cada producto. */
export function useConfirmarCompra() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmarCompraInput) =>
      api<CompraFila>("/compras", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      for (const key of ["compras", "productos", "dashboard", "ganancia-productos"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
