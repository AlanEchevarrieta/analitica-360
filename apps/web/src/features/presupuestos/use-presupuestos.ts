"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/presupuestos (presupuestos.service.ts).
export type EstadoPresupuesto = "pendiente" | "aceptado" | "rechazado" | "vencido";
export type MonedaPresupuesto = "ARS" | "USD" | "BRL" | "CLP";

export const MONEDAS: { id: MonedaPresupuesto; nombre: string; simbolo: string; decimales: number }[] = [
  { id: "ARS", nombre: "Pesos", simbolo: "$", decimales: 2 },
  { id: "USD", nombre: "Dólares", simbolo: "US$", decimales: 2 },
  { id: "BRL", nombre: "Reales", simbolo: "R$", decimales: 2 },
  { id: "CLP", nombre: "Pesos chilenos", simbolo: "CLP$", decimales: 0 },
];
export const monedaDe = (id: MonedaPresupuesto) => MONEDAS.find((m) => m.id === id)!;
/** "US$ 1.234,50" */
export function formatoEnMoneda(n: number, id: MonedaPresupuesto) {
  const m = monedaDe(id);
  return `${m.simbolo} ${n.toLocaleString("es-AR", { minimumFractionDigits: m.decimales, maximumFractionDigits: m.decimales })}`;
}

/** Cuántos pesos vale hoy cada moneda (GET /cotizaciones/monedas). */
export type CotizacionesHoy = Record<Exclude<MonedaPresupuesto, "ARS">, { valor: number; fecha: string; de: string } | null>;

export interface ItemPresupuesto {
  id: string;
  productoId: string;
  varianteId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

interface Base {
  id: string;
  numero: string;
  fecha: string;
  validoHasta: string;
  estado: EstadoPresupuesto;
  clienteId: string | null;
  clienteNombre: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  notas: string | null;
  ventaId: string | null;
  numeroVenta: string | null;
  moneda: MonedaPresupuesto;
  cotizacion: number | null;
  cotizacionDe: string | null;
  /** Montos en la moneda del presupuesto (null en pesos). */
  enMoneda: { subtotal: number; descuento: number; total: number } | null;
}

export type PresupuestoFila = Base & { productos: number };
export type PresupuestoFicha = Base & {
  /** stock: el de hoy (null = kit que se arma al vender). */
  items: (ItemPresupuesto & { stock?: number | null })[]; cliente: { nombre: string; telefono: string | null; email: string | null } | null };

export interface PresupuestoInput {
  clienteId: string | null;
  clienteNombre: string | null;
  items: { productoId: string; varianteId: string | null; cantidad: number; precioUnitario: number }[];
  descuento: number;
  notas: string | null;
  validoHasta: string | null;
  moneda: MonedaPresupuesto;
  /** Pesos por unidad; null = la de hoy. */
  cotizacion: number | null;
}

export const NOMBRE_ESTADO: Record<EstadoPresupuesto, string> = { pendiente: "Pendiente", aceptado: "Aceptado", rechazado: "Rechazado", vencido: "Vencido" };
export const COLOR_ESTADO: Record<EstadoPresupuesto, string> = {
  pendiente: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  aceptado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rechazado: "bg-muted text-muted-foreground",
  vencido: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function usePresupuestos() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["presupuestos", orgId], queryFn: () => api<PresupuestoFila[]>("/presupuestos"), enabled: Boolean(orgId) });
}

export function usePresupuesto(id: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["presupuestos", id, orgId], queryFn: () => api<PresupuestoFicha>(`/presupuestos/${id}`), enabled: Boolean(orgId && id) });
}

export function useCotizacionesHoy() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["cotizaciones-monedas", orgId], queryFn: () => api<CotizacionesHoy>("/cotizaciones/monedas"), enabled: Boolean(orgId), staleTime: 10 * 60_000 });
}

export function useAccionesPresupuesto() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["presupuestos"] });
  const enviar = <T,>(ruta: string, body?: unknown, method = "POST") => api<T>(ruta, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return {
    crear: useMutation({ mutationFn: (d: PresupuestoInput) => enviar<PresupuestoFicha>("/presupuestos", d), onSuccess: refrescar }),
    editar: useMutation({ mutationFn: ({ id, ...d }: PresupuestoInput & { id: string }) => enviar<PresupuestoFicha>(`/presupuestos/${id}`, d, "PUT"), onSuccess: refrescar }),
    estado: useMutation({ mutationFn: ({ id, estado }: { id: string; estado: "pendiente" | "rechazado" }) => enviar(`/presupuestos/${id}/estado`, { estado }), onSuccess: refrescar }),
    aceptar: useMutation({ mutationFn: ({ id, ventaId }: { id: string; ventaId: string }) => enviar(`/presupuestos/${id}/aceptar`, { ventaId }), onSuccess: refrescar }),
    borrar: useMutation({ mutationFn: (id: string) => enviar(`/presupuestos/${id}`, undefined, "DELETE"), onSuccess: refrescar }),
  };
}
