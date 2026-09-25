"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface VarianteVenta {
  id: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  activo: boolean;
}

export interface UbicacionVenta {
  id: string;
  nombre: string;
}

export interface ClienteVenta {
  id: string;
  nombre: string;
  telefono: string | null;
}

export interface ItemVentaInput {
  productoId: string;
  varianteId: string | null;
  cantidad: number;
  precioUnitario: number;
}

export interface ConfirmarVentaInput {
  items: ItemVentaInput[];
  formaPago: string;
  descuento: number;
  clienteNombre: string | null;
  clienteId: string | null;
  cuotas: number;
  coeficienteInteres: number;
  ubicacionOrigen: string | null;
  esSenia: boolean;
  montoSenia: number;
}

/** GET /productos/:id/variantes — se pide al elegir el producto, no para todo el catálogo. */
export function useVariantes() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();
  return (productoId: string) =>
    queryClient.fetchQuery({
      queryKey: ["variantes", orgId, productoId],
      queryFn: () => api<VarianteVenta[]>(`/productos/${productoId}/variantes`),
      staleTime: 60_000,
    });
}

export function useUbicaciones() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["ubicaciones", orgId],
    queryFn: () => api<UbicacionVenta[]>("/ubicaciones"),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
}

export function useClientes() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["clientes", orgId],
    queryFn: () => api<ClienteVenta[]>("/clientes"),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
}

/** POST /ventas: registra la venta y descuenta stock (VentasService.confirmar). */
export function useConfirmarVenta() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmarVentaInput) =>
      api<{ id: string; numeroVenta: string | null; total: number }>("/ventas", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // La venta cambia listados, stock y los totales del inicio.
      for (const key of ["ventas", "productos", "dashboard"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
