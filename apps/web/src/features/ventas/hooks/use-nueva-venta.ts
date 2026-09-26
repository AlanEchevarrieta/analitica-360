"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface UbicacionVenta {
  id: string;
  nombre: string;
}

export interface ClienteVenta {
  id: string;
  nombre: string;
  telefono: string | null;
  listaPrecioId?: string | null;
}

/** GET /ventas/configuracion (configuracion_empresa). */
export interface ConfiguracionVenta {
  mediosPago: string[];
  cuotas: { cuotas: number; tasa: number; etiqueta: string }[];
  ubicacionDefault: string | null;
  mostrarCliente: "siempre" | "opcional" | "no_mostrar";
  crearClienteDesdeVenta: boolean;
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
  listaPrecioId: string | null;
  cuotas: number;
  coeficienteInteres: number;
  ubicacionOrigen: string | null;
  esSenia: boolean;
  montoSenia: number;
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

export function useConfiguracionVenta() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["ventas-configuracion", orgId],
    queryFn: () => api<ConfiguracionVenta>("/ventas/configuracion"),
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

/** POST /clientes: alta rápida desde la venta (solo nombre y teléfono). */
export function useCrearCliente() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nombre: string; telefono: string | null }) =>
      api<ClienteVenta>("/clientes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["clientes"] }),
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
