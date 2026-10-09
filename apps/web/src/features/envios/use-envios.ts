"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { apiArchivo } from "@/lib/api-client";

// Espejo de apps/api/src/modules/envios (envios.service.ts).
export interface ConfigEnvios {
  proveedor: string;
  cuentaId: number;
  origenId: number | null;
  enTienda: boolean;
  gratisDesde: number | null;
  pesoDefectoGr: number;
  verificadoEn: string | null;
  urlAvisos: string | null;
}

export interface EstadoEnvios {
  disponible: boolean;
  config: ConfigEnvios | null;
}

export interface GuardarEnvios {
  cuentaId: number;
  origenId: number | null;
  token: string | null;
  secreto: string | null;
  enTienda: boolean;
  gratisDesde: number | null;
  pesoDefectoGr: number;
}

export interface EnvioCreado {
  id: string;
  estado: string | null;
  estadoNombre: string | null;
}

export function useEnvios() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["envios", orgId], queryFn: () => api<EstadoEnvios>("/envios"), enabled: Boolean(orgId) });
}

export function useAccionesEnvios() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["envios"] });
  const guardar = useMutation({ mutationFn: (c: GuardarEnvios) => api<EstadoEnvios>("/envios", { method: "PUT", body: JSON.stringify(c) }), onSuccess: refrescar });
  const desconectar = useMutation({ mutationFn: () => api<void>("/envios", { method: "DELETE" }), onSuccess: refrescar });
  return { guardar, desconectar };
}

export function useAccionesEnvioPedido(pedidoId: string) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["pedido"] });
    void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
  };
  const crear = useMutation({ mutationFn: () => api<EnvioCreado>(`/pedidos/${pedidoId}/envio`, { method: "POST" }), onSuccess: refrescar });
  const actualizar = useMutation({ mutationFn: () => api<EnvioCreado>(`/pedidos/${pedidoId}/envio/actualizar`, { method: "POST" }), onSuccess: refrescar });
  return { crear, actualizar };
}

/** Abre la etiqueta en otra pestaña para imprimirla. */
export async function abrirEtiqueta(pedidoId: string, token: string | null) {
  const pdf = await apiArchivo(`/pedidos/${pedidoId}/envio/etiqueta`, token);
  const url = URL.createObjectURL(pdf);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Nombre en criollo del estado de Zipnova (igual que NOMBRE_ESTADO de la API). */
export const NOMBRE_ESTADO: Record<string, string> = {
  new: "Creado",
  documentation_ready: "Etiqueta lista",
  ready_to_ship: "Listo para retirar",
  cancelled: "Cancelado",
  expired: "Vencido sin despachar",
  shipped: "Despachado",
  in_transit_to_crossdock: "Retirado",
  admitted: "Entregado en sucursal",
  crossdock: "En el centro de distribución",
  received_by_carrier: "Recibido por el correo",
  in_transit: "En camino",
  delivery_attempt: "Intento de entrega",
  out_for_delivery: "En reparto",
  available_for_pickup: "Para retirar en sucursal",
  delivered: "Entregado",
  delivered_with_damage: "Entregado (con daños)",
  not_delivered: "No entregado",
  rejected: "Rechazado por el correo",
  returned_to_seller: "Devuelto",
  lost: "Perdido",
  lost_in_carrier: "Perdido por el correo",
};
