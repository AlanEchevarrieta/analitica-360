"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlan } from "@/hooks/use-plan";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export type Tramo = "al_dia" | "mas_30" | "mas_60" | "mas_90";

export const TRAMOS: { id: Tramo; etiqueta: string; clase: string }[] = [
  { id: "al_dia", etiqueta: "Hasta 30 días", clase: "text-foreground" },
  { id: "mas_30", etiqueta: "31 a 60 días", clase: "text-amber-600 dark:text-amber-400" },
  { id: "mas_60", etiqueta: "61 a 90 días", clase: "text-orange-600 dark:text-orange-400" },
  { id: "mas_90", etiqueta: "Más de 90 días", clase: "text-destructive" },
];

export interface Deudor {
  clienteId: string | null;
  nombre: string;
  telefono: string | null;
  saldo: number;
  ventas: number;
  desde: string;
  dias: number;
  tramos: Record<Tramo, number>;
}

export interface ResumenCuentaCorriente {
  total: number;
  tramos: Record<Tramo, number>;
  deudores: Deudor[];
}

export interface CuentaCliente {
  cliente: { id: string; nombre: string; telefono: string | null };
  saldo: number;
  pendientes: { ventaId: string; numero: string | null; fecha: string; saldo: number; dias: number }[];
  movimientos: { fecha: string; concepto: string; debe: number; haber: number; saldo: number; ventaId?: string | null; cobroId?: string | null }[];
  cobros: { id: string; fecha: string; monto: number; formaPago: string; notas: string | null; anulado: boolean; ventas: string[] }[];
}

/** Mensaje amable de recordatorio con el saldo. */
export function mensajeRecordatorio(nombreCliente: string, negocio: string, saldo: number) {
  const monto = saldo.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  return `Hola ${nombreCliente.split(" ")[0]}! Te escribimos de ${negocio}. Te recordamos que tenés un saldo pendiente de ${monto}. Cuando puedas, avisanos cómo preferís abonarlo. ¡Gracias!`;
}

export function useCuentaCorriente() {
  const { incluye } = usePlan();
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["cuenta-corriente", orgId], queryFn: () => api<ResumenCuentaCorriente>("/cuenta-corriente"), enabled: Boolean(orgId) && incluye("cuenta_corriente") });
}

export function useCuentaCliente(clienteId: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["cuenta-corriente", orgId, clienteId], queryFn: () => api<CuentaCliente>(`/cuenta-corriente/${clienteId}`), enabled: Boolean(orgId) });
}

export function useAccionesCuenta(clienteId: string) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => {
    for (const k of ["cuenta-corriente", "cliente", "clientes", "ventas", "venta", "estados-contables", "contabilidad", "analytics", "dashboard"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  return {
    cobrar: useMutation({
      mutationFn: (c: { monto: number; formaPago: string; fecha: string; notas: string | null }) => api(`/cuenta-corriente/${clienteId}/cobros`, { method: "POST", body: JSON.stringify(c) }),
      onSuccess: refrescar,
    }),
    anular: useMutation({ mutationFn: (cobroId: string) => api(`/cuenta-corriente/cobros/${cobroId}/anular`, { method: "POST" }), onSuccess: refrescar }),
  };
}
