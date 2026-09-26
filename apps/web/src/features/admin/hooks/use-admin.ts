"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejos de apps/api modules/admin-saas (admin-clientes.types.ts, admin-saas.repository.ts) y soporte.
export type AlertaEmpresa = "sin_actividad" | "ventas_bajan" | "vence_pronto" | "prueba_termina" | "vencida" | "sin_suscripcion";

export interface EmpresaAdmin {
  id: string;
  nombre: string;
  esDemo: boolean;
  alta: string;
  baja: string | null;
  suscripcionId: string | null;
  plan: string | null;
  precioPlan: number;
  estado: string | null;
  vencimiento: string | null;
  usuarios: number;
  productos: number;
  ventas30: number;
  monto30: number;
  montoPrevio30: number;
  ultimaVenta: string | null;
  ticketsAbiertos: number;
  pagadoTotal: number;
  ultimoPago: string | null;
  diasSinVender: number | null;
  alertas: AlertaEmpresa[];
}

export interface EmpresaDetalleAdmin {
  empresa: EmpresaAdmin;
  ventasPorMes: { mes: string; ventas: number; monto: number }[];
  usuarios: { nombre: string | null; email: string; rol: string; alta: string }[];
  pagos: { id: string; montoArs: number; metodo: string; estado: string; periodo: string | null; notas: string | null; fecha: string }[];
  tickets: { id: string; numeroTicket: string | null; asunto: string; estado: string; prioridad: string; fecha: string }[];
  historialPlanes: { fecha: string; planAnterior: string | null; planNuevo: string; motivo: string | null }[];
  uso: { clientes: number; compras: number; pedidos: number; ventasTotales: number; primeraVenta: string | null };
}

export interface MetricasAdmin {
  mrr: number;
  totalEmpresas: number;
  activas: number;
  enPrueba: number;
  vencidas: number;
  nuevasEsteMes: number;
  nuevasMesAnterior: number;
  pagosEsteMes: number;
  empresasPorPlan: { plan: string; cantidad: number }[];
}

export interface MesAdmin {
  mes: string;
  altas: number;
  bajas: number;
  clientes: number;
  clientesActivos: number;
  cobrado: number;
  ventas: number;
  montoVendido: number;
}

export interface CapacidadAdmin {
  ventas: number;
  productos: number;
  clientes: number;
  movimientos: number;
  empresas: number;
  totalRegistros: number;
  registrosUltimoMes: number;
  baseBytes: number;
  tablas: { tabla: string; bytes: number; filas: number }[];
}

export interface PagoAdmin {
  id: string;
  empresaId: string;
  empresaNombre: string;
  montoArs: number;
  metodo: string;
  estado: string;
  periodo: string | null;
  notas: string | null;
  createdAt: string;
}

export interface TicketAdmin {
  id: string;
  empresaId: string;
  empresaNombre: string;
  numeroTicket: string | null;
  asunto: string;
  categoria: string;
  prioridad: string;
  estado: string;
  createdAt: string;
}

export interface TicketAdminFicha extends Omit<TicketAdmin, "empresaId"> {
  empresaId: string;
  descripcion: string;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  respuestas: { id: string; esAdmin: boolean; contenido: string; createdAt: string }[];
}

function useConsulta<T>(clave: unknown[], ruta: string | null, opciones: { reintentar?: boolean; staleTime?: number } = {}) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["admin", ...clave, orgId],
    queryFn: () => api<T>(ruta!),
    enabled: Boolean(orgId && ruta),
    retry: opciones.reintentar === false ? false : 2,
    staleTime: opciones.staleTime,
  });
}

/** ¿Quien entra es administrador de la app? (se consulta cada 5 minutos, no en cada pantalla). */
export const useEsAdmin = () => useConsulta<{ admin: boolean }>(["yo"], "/admin/yo", { reintentar: false, staleTime: 5 * 60_000 });
export const useMetricasAdmin = () => useConsulta<MetricasAdmin>(["metrics"], "/admin/metrics");
export const useEvolucionAdmin = () => useConsulta<MesAdmin[]>(["evolucion"], "/admin/evolucion");
export const useEmpresasAdmin = () => useConsulta<EmpresaAdmin[]>(["empresas"], "/admin/empresas");
export const useEmpresaAdmin = (id: string) => useConsulta<EmpresaDetalleAdmin>(["empresa", id], `/admin/empresas/${id}`);
export const useCapacidadAdmin = () => useConsulta<CapacidadAdmin>(["capacidad"], "/admin/capacidad");
export const usePlanesAdmin = () => useConsulta<{ id: string; nombre: string }[]>(["planes"], "/admin/planes");
export const usePagosAdmin = (estado: string, periodo: string) =>
  useConsulta<PagoAdmin[]>(["pagos", estado, periodo], `/admin/pagos?estado=${estado}&periodo=${periodo}`);
export const useTicketsAdmin = () => useConsulta<TicketAdmin[]>(["tickets"], "/tickets/admin");
export const useTicketAdmin = (id: string) => useConsulta<TicketAdminFicha>(["ticket", id], `/tickets/admin/${id}`);

export function useAccionesAdmin() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });
  const post = (ruta: string, body: unknown, method = "POST") => api(ruta, { method, body: JSON.stringify(body) });
  return {
    registrarPago: useMutation({
      mutationFn: (p: { empresaId: string; monto: number; metodo: string; periodo: string; notas: string }) => post("/admin/pagos", p),
      onSuccess: refrescar,
    }),
    asignarPlan: useMutation({
      mutationFn: (p: { empresaId: string; planId: string; fechaVencimiento: string }) => post("/admin/suscripciones/asignar", p),
      onSuccess: refrescar,
    }),
    cambiarEstado: useMutation({
      mutationFn: ({ suscripcionId, estado }: { suscripcionId: string; estado: string }) => post(`/admin/suscripciones/${suscripcionId}/estado`, { estado }, "PATCH"),
      onSuccess: refrescar,
    }),
    marcarDemo: useMutation({
      mutationFn: ({ empresaId, esDemo }: { empresaId: string; esDemo: boolean }) => post(`/admin/empresas/${empresaId}/demo`, { esDemo }, "PATCH"),
      onSuccess: refrescar,
    }),
    responderTicket: useMutation({
      mutationFn: ({ id, contenido }: { id: string; contenido: string }) => post(`/tickets/admin/${id}/respuestas`, { contenido }),
      onSuccess: refrescar,
    }),
    estadoTicket: useMutation({
      mutationFn: ({ id, estado }: { id: string; estado: string }) => post(`/tickets/admin/${id}/estado`, { estado }, "PATCH"),
      onSuccess: refrescar,
    }),
  };
}

export const NOMBRE_ALERTA: Record<AlertaEmpresa, { texto: string; clase: string }> = {
  vencida: { texto: "Vencida", clase: "bg-red-500/15 text-red-400" },
  vence_pronto: { texto: "Vence pronto", clase: "bg-amber-500/15 text-amber-400" },
  prueba_termina: { texto: "Termina la prueba", clase: "bg-amber-500/15 text-amber-400" },
  sin_suscripcion: { texto: "Sin plan", clase: "bg-red-500/15 text-red-400" },
  sin_actividad: { texto: "Sin actividad", clase: "bg-zinc-500/20 text-zinc-300" },
  ventas_bajan: { texto: "Ventas en baja", clase: "bg-orange-500/15 text-orange-400" },
};

export const NOMBRE_ESTADO: Record<string, string> = {
  activa: "Activa",
  periodo_prueba: "En prueba",
  pendiente_pago: "Pendiente de pago",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const NOMBRE_PLAN = (p: string | null) => (p ? ({ basico: "Básico", starter: "Starter", pro: "Pro", premium: "Premium", ecommerce: "E-commerce" }[p.toLowerCase()] ?? p) : "—");

export const fechaCorta = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
