"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/soporte/ticket.repository.ts.
export type CategoriaTicket = "consulta" | "bug" | "sugerencia" | "facturacion" | "otro";
export type PrioridadTicket = "baja" | "media" | "alta" | "urgente";
export type EstadoTicket = "abierto" | "en_proceso" | "resuelto" | "cerrado";

export interface TicketFila {
  id: string;
  numeroTicket: string | null;
  asunto: string;
  categoria: CategoriaTicket;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  createdAt: string;
}

export interface TicketFicha extends TicketFila {
  descripcion: string;
  vistoClienteAt: string | null;
  updatedAt: string;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  respuestas: { id: string; esAdmin: boolean; contenido: string; createdAt: string }[];
}

export const CATEGORIAS: Record<CategoriaTicket, string> = {
  consulta: "Consulta general",
  bug: "Error o falla",
  sugerencia: "Sugerencia",
  facturacion: "Facturación",
  otro: "Otro",
};
export const PRIORIDADES: Record<PrioridadTicket, string> = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" };
export const ESTADOS: Record<EstadoTicket, { etiqueta: string; clase: string }> = {
  abierto: { etiqueta: "Abierto", clase: "bg-sky-500/15 text-sky-600" },
  en_proceso: { etiqueta: "En proceso", clase: "bg-amber-500/15 text-amber-600" },
  resuelto: { etiqueta: "Resuelto", clase: "bg-emerald-500/15 text-emerald-600" },
  cerrado: { etiqueta: "Cerrado", clase: "bg-muted text-muted-foreground" },
};

export function useTickets() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["tickets", orgId], queryFn: () => api<TicketFila[]>("/tickets"), enabled: Boolean(orgId) });
}

export function useTicket(id: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["ticket", orgId, id], queryFn: () => api<TicketFicha>(`/tickets/${id}`), enabled: Boolean(orgId) });
}

export function useAccionesTicket() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => {
    for (const k of ["tickets", "ticket", "tickets-no-leidos"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const crear = useMutation({
    mutationFn: (t: { asunto: string; descripcion: string; categoria: CategoriaTicket; prioridad: PrioridadTicket }) =>
      api<TicketFicha>("/tickets", { method: "POST", body: JSON.stringify(t) }),
    onSuccess: refrescar,
  });
  const responder = useMutation({
    mutationFn: ({ id, contenido }: { id: string; contenido: string }) => api(`/tickets/${id}/respuestas`, { method: "POST", body: JSON.stringify({ contenido }) }),
    onSuccess: refrescar,
  });
  const marcarVisto = useMutation({ mutationFn: (id: string) => api(`/tickets/${id}/visto`, { method: "POST" }), onSuccess: refrescar });
  return { crear, responder, marcarVisto };
}
