"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

/** GET /productos/:id (ProductoRecord). */
export interface ProductoDetalle {
  id: string;
  nombre: string;
  categoriaId: string | null;
  codigoBarra: string | null;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
  altoCm: number | null;
  largoCm: number | null;
  anchoCm: number | null;
  pesoGr: number | null;
}

/** GET /productos/:id/variantes (con stock). */
export interface VarianteDetalle {
  id: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
  stock: number;
}

export interface Categoria {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Atributo {
  id: string;
  nombre: string;
  valores: string[];
}

export interface GuardarProducto {
  id: string | null;
  datos: { nombre: string; categoriaId: string | null; precioVenta: number | null; costo: number | null; activo: boolean };
  /** undefined = no cambió (no se manda). */
  codigoBarra?: string | null;
  variantes?: {
    id?: string;
    sku: string | null;
    atributos: Record<string, string>;
    precioVenta: number | null;
    costo: number | null;
    activo: boolean;
  }[];
  dimensiones?: { altoCm: number | null; largoCm: number | null; anchoCm: number | null; pesoGr: number | null };
}

export function useProducto(id: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["producto", orgId, id],
    queryFn: () => api<ProductoDetalle>(`/productos/${id}`),
    enabled: Boolean(orgId && id),
  });
}

export function useVariantesProducto(id: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["variantes", orgId, id],
    queryFn: () => api<VarianteDetalle[]>(`/productos/${id}/variantes`),
    enabled: Boolean(orgId && id),
  });
}

export function useCategorias() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["categorias", orgId],
    queryFn: () => api<Categoria[]>("/categorias?soloActivas=true"),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
}

export function useAtributos() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["atributos", orgId],
    queryFn: () => api<Atributo[]>("/atributos"),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
}

export function useCrearCategoria() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nombre: string) => api<Categoria>("/categorias", { method: "POST", body: JSON.stringify({ nombre }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categorias"] }),
  });
}

/**
 * Guarda el producto y, si cambiaron, su código de barras, variantes y
 * medidas (cada uno es un endpoint propio en la API). Si un paso falla, los
 * anteriores ya quedaron guardados: el error dice cuál no se pudo guardar.
 */
export function useGuardarProducto() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (g: GuardarProducto) => {
      const producto = g.id
        ? await api<ProductoDetalle>(`/productos/${g.id}`, { method: "PATCH", body: JSON.stringify(g.datos) })
        : await api<ProductoDetalle>("/productos", { method: "POST", body: JSON.stringify(g.datos) });
      const paso = async (nombre: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
        } catch (e) {
          const motivo = e instanceof Error ? e.message : "error desconocido";
          throw new Error(`El producto se guardó, pero no ${nombre}: ${motivo}`);
        }
      };
      if (g.codigoBarra !== undefined) {
        await paso("el código de barras", () =>
          api(`/productos/${producto.id}/codigo-barra`, { method: "PATCH", body: JSON.stringify({ codigoBarra: g.codigoBarra }) }),
        );
      }
      if (g.variantes) {
        await paso("las variantes", () =>
          api(`/productos/${producto.id}/variantes`, { method: "PUT", body: JSON.stringify({ variantes: g.variantes }) }),
        );
      }
      if (g.dimensiones) {
        await paso("las medidas", () =>
          api(`/productos/${producto.id}/dimensiones`, { method: "PATCH", body: JSON.stringify(g.dimensiones) }),
        );
      }
      return producto;
    },
    onSettled: () => {
      for (const key of ["productos", "producto", "variantes", "dashboard"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
