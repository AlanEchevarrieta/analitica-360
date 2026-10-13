"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/abonos.
export type TipoAbono = "mensual" | "paquete";
export type EstadoAbono = "sin_cobrar" | "al_dia" | "por_vencer" | "vencido" | "sin_sesiones" | "baja";

export const NOMBRE_ESTADO_ABONO: Record<EstadoAbono, string> = {
  sin_cobrar: "Sin cobrar",
  al_dia: "Al día",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_sesiones: "Sin sesiones",
  baja: "De baja",
};
export const COLOR_ESTADO_ABONO: Record<EstadoAbono, string> = {
  sin_cobrar: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  al_dia: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  por_vencer: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  vencido: "bg-red-500/15 text-red-700 dark:text-red-300",
  sin_sesiones: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  baja: "bg-muted text-muted-foreground",
};

export interface PlanAbono {
  id: string;
  nombre: string;
  tipo: TipoAbono;
  precio: number;
  sesiones: number | null;
  vigenciaDias: number | null;
  productoId: string;
  activo: boolean;
  abonados: number;
}

export interface AbonoFila {
  id: string;
  clienteId: string;
  cliente: string;
  telefono: string | null;
  planId: string;
  plan: string;
  tipo: TipoAbono;
  precio: number;
  estado: EstadoAbono;
  hasta: string | null;
  sesionesRestantes: number | null;
  deuda: number;
  notas: string | null;
  alta: string;
}

export interface AbonoFicha extends AbonoFila {
  proximoDesde: string;
  periodos: { id: string; desde: string; hasta: string; sesiones: number | null; usadas: number; monto: number; ventaId: string; numeroVenta: string | null; saldo: number }[];
  usos: { id: string; fecha: string; periodoId: string; turnoId: string | null; nota: string | null }[];
}

export interface ResumenAbonos {
  activos: number;
  vencidos: number;
  porVencer: number;
  deuda: number;
  mensual: number;
}

export interface CobroAbono {
  formaPago: string;
  desde?: string | null;
  ubicacionOrigen?: string | null;
}

export interface PlanAbonoInput {
  nombre: string;
  tipo: TipoAbono;
  precio: number;
  sesiones: number | null;
  vigenciaDias: number | null;
  activo?: boolean;
  actualizarAbonos?: boolean;
}

function useConsulta<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["abonos", ...clave, orgId], queryFn: () => api<T>(ruta!), enabled: Boolean(orgId && ruta) });
}

export const usePlanesAbono = () => useConsulta<PlanAbono[]>(["planes"], "/abonos/planes");
export const useAbonos = (estado: string) => useConsulta<{ resumen: ResumenAbonos; filas: AbonoFila[] }>(["lista", estado], `/abonos?estado=${estado}`);
export const useAbono = (id: string) => useConsulta<AbonoFicha>(["ficha", id], `/abonos/${id}`);
export const useAbonosDelCliente = (clienteId: string | null) => useConsulta<AbonoFila[]>(["cliente", clienteId], clienteId ? `/abonos/cliente/${clienteId}` : null);

function useOp<A, T>(fn: (a: A) => Promise<T>, conVenta = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of ["abonos", "agenda", ...(conVenta ? ["ventas", "venta", "dashboard", "cuenta-corriente", "productos"] : [])]) void queryClient.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function useAccionesAbonos() {
  const api = useApiFetch();
  const enviar = <T,>(ruta: string, body?: unknown, method = "POST") => api<T>(ruta, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return {
    crearPlan: useOp((d: PlanAbonoInput) => enviar<PlanAbono>("/abonos/planes", d), true),
    editarPlan: useOp(({ id, ...d }: PlanAbonoInput & { id: string }) => enviar<PlanAbono>(`/abonos/planes/${id}`, d, "PUT"), true),
    borrarPlan: useOp((id: string) => enviar(`/abonos/planes/${id}`, undefined, "DELETE")),
    crear: useOp((d: { clienteId: string; planId: string; precio: number | null; notas: string | null; cobro: CobroAbono | null }) => enviar<AbonoFicha>("/abonos", d), true),
    editar: useOp(({ id, ...d }: { id: string; precio: number; notas: string | null }) => enviar<AbonoFicha>(`/abonos/${id}`, d, "PUT")),
    cobrar: useOp(({ id, ...d }: CobroAbono & { id: string }) => enviar<AbonoFicha>(`/abonos/${id}/cobrar`, d), true),
    usar: useOp(({ id, ...d }: { id: string; turnoId?: string | null; nota?: string | null }) => enviar<AbonoFicha>(`/abonos/${id}/usar`, d)),
    deshacerUso: useOp(({ id, usoId }: { id: string; usoId: string }) => enviar<AbonoFicha>(`/abonos/${id}/usos/${usoId}`, undefined, "DELETE")),
    baja: useOp(({ id, activo }: { id: string; activo: boolean }) => enviar<AbonoFicha>(`/abonos/${id}/${activo ? "reactivar" : "baja"}`)),
    mensaje: useOp((id: string) => enviar<{ mensaje: string; telefono: string | null; whatsapp: string }>(`/abonos/${id}/mensaje`)),
  };
}

/** "15/10/2026" */
export const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;

/** "Mensual" / "10 sesiones · 60 días" */
export function detallePlan(p: { tipo: TipoAbono; sesiones: number | null; vigenciaDias: number | null }) {
  if (p.tipo === "mensual") return p.sesiones ? `Mensual · ${p.sesiones} sesiones por mes` : "Mensual · libre";
  return `${p.sesiones ?? "?"} sesiones · vale ${p.vigenciaDias ?? 60} días`;
}
