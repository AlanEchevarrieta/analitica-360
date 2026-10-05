"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { usePlan } from "@/hooks/use-plan";
import type { EstadoPedido, OrigenPedido, PedidoDetalle, PedidoFila, Remitente } from "../types";

export const PEDIDOS_POR_PAGINA = 25;

export function usePedidos(pagina: number, estado: EstadoPedido | "", origen: OrigenPedido | "") {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const params = new URLSearchParams({ pagina: String(pagina), pageSize: String(PEDIDOS_POR_PAGINA), estado, origen });
  return useQuery({
    queryKey: ["pedidos", orgId, pagina, estado, origen],
    queryFn: () => api<{ items: PedidoFila[]; total: number }>(`/pedidos?${params}`),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}

export function usePedido(id: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["pedido", orgId, id],
    queryFn: () => api<PedidoDetalle>(`/pedidos/${id}`),
    enabled: Boolean(orgId),
  });
}

export function useColaboradores() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { disponible } = usePlan();
  return useQuery({
    queryKey: ["pedidos-colaboradores", orgId],
    queryFn: () => api<{ id: string; nombre: string }[]>("/pedidos/colaboradores"),
    enabled: Boolean(orgId) && disponible("pedidos"),
    staleTime: 5 * 60_000,
  });
}

export function useRemitente() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { disponible } = usePlan();
  return useQuery({
    queryKey: ["pedidos-remitente", orgId],
    queryFn: () => api<Remitente>("/pedidos/remitente"),
    enabled: Boolean(orgId) && disponible("pedidos"),
    staleTime: 5 * 60_000,
  });
}

/** Todas las acciones sobre un pedido: al terminar se refresca la ficha, el listado y (si despacha) ventas/stock. */
export function useAccionesPedido(id: string) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSettled = () => {
    for (const key of ["pedido", "pedidos", "ventas", "productos", "dashboard"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const post = (ruta: string, body?: unknown) =>
    api(`/pedidos/${id}${ruta}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });

  const prepararItem = useMutation({
    mutationFn: (i: { itemId: string; cantidadPreparada: number; preparado: boolean }) =>
      api(`/pedidos/${id}/items/${i.itemId}/preparacion`, {
        method: "PATCH",
        body: JSON.stringify({ cantidadPreparada: i.cantidadPreparada, preparado: i.preparado }),
      }),
    onSettled,
  });
  const marcarTodo = useMutation({ mutationFn: () => post("/marcar-todo-preparado"), onSettled });
  const confirmarListo = useMutation({ mutationFn: () => post("/confirmar-listo-despacho"), onSettled });
  const despachar = useMutation({
    mutationFn: (d: { transportista: string | null; numeroSeguimiento: string | null; ubicacionOrigen: string | null; formaPago: string }) =>
      post("/despacho", d),
    onSettled,
  });
  const conTransportista = useMutation({ mutationFn: () => post("/con-transportista"), onSettled });
  const entregado = useMutation({ mutationFn: () => post("/entregado"), onSettled });
  const cancelar = useMutation({ mutationFn: () => post("/cancelar"), onSettled });
  const asignar = useMutation({
    mutationFn: (usuarioId: string | null) =>
      api(`/pedidos/${id}/asignar`, { method: "PATCH", body: JSON.stringify({ usuarioId }) }),
    onSettled,
  });

  return { prepararItem, marcarTodo, confirmarListo, despachar, conTransportista, entregado, cancelar, asignar };
}
