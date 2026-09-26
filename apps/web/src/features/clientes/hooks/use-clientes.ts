"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
  notasLibres: string | null;
  etiquetas: string[];
  /** Lista de precios que se le aplica al venderle (null = precio normal). */
  listaPrecioId: string | null;
  ultimaCompra: string | null;
  totalGastado: number;
  cantidadCompras: number;
}

export const TIPOS_INTERACCION = {
  nota: "Nota",
  preferencia: "Preferencia",
  dato_personal: "Dato personal",
  queja: "Queja",
  cumplido: "Cumplido",
  seguimiento: "Seguimiento",
} as const;

export interface ClienteFicha extends Cliente {
  ventas: { id: string; fecha: string; productos: string; total: number; formaPago: string }[];
  interacciones: { id: string; tipo: keyof typeof TIPOS_INTERACCION; contenido: string; privado: boolean; createdAt: string }[];
}

export interface ClienteSegmento {
  id: string;
  nombre: string;
  telefono: string | null;
  dias: number | null;
  ultimaCompra: string | null;
  totalFacturado: number | null;
}

export interface Segmentos {
  inactivos: ClienteSegmento[];
  enRiesgo: ClienteSegmento[];
  cumpleanos: ClienteSegmento[];
  vip: ClienteSegmento[];
}

export interface DatosCliente {
  nombre: string;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
  notasLibres: string | null;
  etiquetas: string[];
  listaPrecioId: string | null;
}

function useGet<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: [...clave, orgId], queryFn: () => api<T>(ruta!), enabled: Boolean(orgId && ruta) });
}

export const useClientesLista = () => useGet<Cliente[]>(["clientes"], "/clientes");
export const useCliente = (id: string | null) => useGet<ClienteFicha>(["cliente", id], id ? `/clientes/${id}` : null);
export const useSegmentos = () => useGet<Segmentos>(["clientes-segmentos"], "/clientes/segmentos");
export const useDifusiones = () =>
  useGet<{ id: string; segmento: string; mensaje: string; cantidad: number; fecha: string }[]>(["difusiones"], "/difusiones");

export function useAccionesClientes() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSuccess = () => {
    for (const k of ["clientes", "cliente", "clientes-segmentos", "difusiones"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const guardar = useMutation({
    mutationFn: ({ id, datos }: { id: string | null; datos: DatosCliente }) =>
      api<Cliente>(id ? `/clientes/${id}` : "/clientes", { method: id ? "PATCH" : "POST", body: JSON.stringify(datos) }),
    onSuccess,
  });
  const interaccion = useMutation({
    mutationFn: ({ id, tipo, contenido }: { id: string; tipo: string; contenido: string }) =>
      api(`/clientes/${id}/interacciones`, { method: "POST", body: JSON.stringify({ tipo, contenido, privado: false }) }),
    onSuccess,
  });
  const difusion = useMutation({
    mutationFn: (d: { segmento: string; mensaje: string; cantidad: number }) => api("/difusiones", { method: "POST", body: JSON.stringify(d) }),
    onSuccess,
  });
  return { guardar, interaccion, difusion };
}

/** Link de WhatsApp: un celular argentino de 10 dígitos pasa a 549 + número. */
export function linkWhatsApp(telefono: string | null, mensaje: string) {
  const d = (telefono ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `https://wa.me/${d.length === 10 ? `549${d}` : d}?text=${encodeURIComponent(mensaje)}`;
}
