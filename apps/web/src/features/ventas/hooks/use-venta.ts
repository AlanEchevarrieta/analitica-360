"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { VentaFila } from "../types";

export interface VentaItemDetalle {
  productoId: string;
  varianteId: string | null;
  productoNombre: string;
  varianteEtiqueta: string | null;
  cantidad: number;
  precioUnitario: number;
  devueltas: number;
}

export interface VentaDetalle extends VentaFila {
  descuento: number;
  cuotas: number;
  coeficienteInteres: number;
  totalSinInteres: number | null;
  montoSenia: number;
  notas: string | null;
  items: VentaItemDetalle[];
}

export interface DevolucionFila {
  id: string;
  numero: number | null;
  tipo: "devolucion" | "cambio";
  estado: "pendiente" | "procesado" | "cancelado";
  fecha: string;
  ventaId: string | null;
  ventaLabel: string | null;
  motivo: string | null;
  productos: string;
}

export interface RegistrarDevolucionInput {
  tipo: "devolucion" | "cambio";
  ventaId: string;
  motivo: string | null;
  items: { productoId: string; varianteId: string | null; cantidad: number; precioUnitario: number; tipo: "devuelto" | "entregado" }[];
}

const CLAVES_VENTA = ["venta", "ventas", "productos", "dashboard", "ganancia-productos", "devoluciones"];

export function useVenta(id: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["venta", orgId, id],
    queryFn: () => api<VentaDetalle>(`/ventas/${id}`),
    enabled: Boolean(orgId),
  });
}

export function useDevoluciones() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["devoluciones", orgId],
    queryFn: () => api<DevolucionFila[]>("/devoluciones"),
    enabled: Boolean(orgId),
  });
}

/** Anular, cobrar saldo y devolver: todo refresca venta, listados, stock e indicadores. */
export function useAccionesVenta(id: string) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSuccess = () => {
    for (const key of CLAVES_VENTA) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const anular = useMutation({
    mutationFn: (motivo: string) => api(`/ventas/${id}/anular`, { method: "POST", body: JSON.stringify({ motivo }) }),
    onSuccess,
  });
  const cobrarSaldo = useMutation({
    mutationFn: (c: { monto: number; formaPago: string; fecha: string }) =>
      api(`/ventas/${id}/cobrar-saldo`, { method: "POST", body: JSON.stringify(c) }),
    onSuccess,
  });
  const devolver = useMutation({
    mutationFn: (d: RegistrarDevolucionInput) => api("/devoluciones", { method: "POST", body: JSON.stringify(d) }),
    onSuccess,
  });
  return { anular, cobrarSaldo, devolver };
}

export function useAccionesDevolucion() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSuccess = () => {
    for (const key of CLAVES_VENTA) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const procesar = useMutation({ mutationFn: (id: string) => api(`/devoluciones/${id}/procesar`, { method: "POST" }), onSuccess });
  const cancelar = useMutation({ mutationFn: (id: string) => api(`/devoluciones/${id}/cancelar`, { method: "POST" }), onSuccess });
  return { procesar, cancelar };
}
