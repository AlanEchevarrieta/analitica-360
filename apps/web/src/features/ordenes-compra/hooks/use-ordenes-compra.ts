"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/compras (ordenes-compra.repository.ts).
export type EstadoOc = "borrador" | "enviada" | "confirmada" | "recibida_parcial" | "recibida" | "cancelada";

export interface OrdenCompraFila {
  id: string;
  numeroOc: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  estado: EstadoOc;
  fechaEmision: string;
  fechaEntregaEstimada: string | null;
  notas: string | null;
  total: number;
}

export interface OrdenCompraItem {
  id: string;
  productoId: string;
  varianteId: string | null;
  productoNombre: string;
  varianteEtiqueta: string | null;
  cantidadPedida: number;
  precioUnitario: number;
  cantidadRecibida: number;
  recibido: boolean;
}

export type OrdenCompraFicha = OrdenCompraFila & { items: OrdenCompraItem[]; proveedorContacto: string | null; proveedorCuit: string | null };

export interface GuardarOrdenCompra {
  proveedorId: string | null;
  fechaEntregaEstimada: string | null;
  notas: string | null;
  /** Sin estado al editar: se mantiene el que tenía. */
  estado?: "borrador" | "enviada";
  items: { productoId: string; varianteId: string | null; cantidadPedida: number; precioUnitario: number }[];
}

export const NOMBRE_ESTADO_OC: Record<EstadoOc, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  confirmada: "Confirmada",
  recibida_parcial: "Llegó una parte",
  recibida: "Recibida",
  cancelada: "Cancelada",
};
export const COLOR_ESTADO_OC: Record<EstadoOc, string> = {
  borrador: "bg-muted text-muted-foreground",
  enviada: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  confirmada: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  recibida_parcial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  recibida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-red-500/10 text-red-600 dark:text-red-400",
};
/** Se puede editar mientras no llegó nada (igual que la API). */
export const ESTADOS_EDITABLES: EstadoOc[] = ["borrador", "enviada", "confirmada"];

export function useOrdenesCompra(estado: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["ordenes-compra", estado, orgId], queryFn: () => api<OrdenCompraFila[]>(`/ordenes-compra?estado=${encodeURIComponent(estado)}`), enabled: Boolean(orgId) });
}

export function useOrdenCompra(id: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["ordenes-compra", "ficha", id, orgId], queryFn: () => api<OrdenCompraFicha>(`/ordenes-compra/${id}`), enabled: Boolean(orgId && id) });
}

export function useAccionesOrdenCompra() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = (conStock = false) => {
    for (const key of ["ordenes-compra", ...(conStock ? ["compras", "productos", "dashboard", "ganancia-productos", "estados-contables"] : [])]) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const enviar = <T,>(ruta: string, body: unknown, method = "POST") => api<T>(ruta, { method, body: JSON.stringify(body) });
  return {
    crear: useMutation({ mutationFn: (d: GuardarOrdenCompra) => enviar<OrdenCompraFicha>("/ordenes-compra", d), onSuccess: () => refrescar() }),
    editar: useMutation({ mutationFn: ({ id, ...d }: GuardarOrdenCompra & { id: string }) => enviar<OrdenCompraFicha>(`/ordenes-compra/${id}`, d, "PATCH"), onSuccess: () => refrescar() }),
    estado: useMutation({ mutationFn: ({ id, estado }: { id: string; estado: EstadoOc }) => enviar(`/ordenes-compra/${id}/estado`, { estado }, "PATCH"), onSuccess: () => refrescar() }),
    recibir: useMutation({
      mutationFn: ({ id, cantidades, ubicacionDestino }: { id: string; cantidades: Record<string, number>; ubicacionDestino: string | null }) =>
        enviar<OrdenCompraFicha>(`/ordenes-compra/${id}/recepcion`, { cantidades, ubicacionDestino }),
      onSuccess: () => refrescar(true),
    }),
  };
}
