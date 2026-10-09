"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { apiArchivo } from "@/lib/api-client";

// Espejo de apps/api/src/modules/arca (facturacion.service.ts).
export interface ConfigFacturacion {
  cuit: string;
  razonSocial: string;
  domicilio: string;
  inicioActividades: string | null;
  iibb: string | null;
  puntoVenta: number;
  verificadoEn?: string | null;
}

export interface EstadoFacturacion {
  disponible: boolean;
  ambiente: "homologacion" | "produccion";
  config: ConfigFacturacion | null;
}

export interface Comprobante {
  id: string;
  tipo: number;
  nombre: string;
  numero: string;
  fecha: string;
  total: number;
  cae: string;
  caeVence: string;
  ventaId: string | null;
  receptorNombre: string | null;
  asociadoId: string | null;
  prueba: boolean;
}

export interface Receptor {
  docTipo: 80 | 96 | 99;
  docNro: string;
  nombre: string | null;
  condicionIva: 1 | 4 | 5 | 6;
}

export function useFacturacion() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["facturacion", orgId], queryFn: () => api<EstadoFacturacion>("/facturacion"), enabled: Boolean(orgId) });
}

export function useComprobantesDeVenta(ventaId: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["comprobantes", orgId, ventaId], queryFn: () => api<Comprobante[]>(`/facturacion/ventas/${ventaId}`), enabled: Boolean(orgId) });
}

export function useAccionesFacturacion() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["facturacion"] });
    void queryClient.invalidateQueries({ queryKey: ["comprobantes"] });
  };
  const guardarConfig = useMutation({ mutationFn: (c: ConfigFacturacion) => api<EstadoFacturacion>("/facturacion/config", { method: "PUT", body: JSON.stringify(c) }), onSuccess: refrescar });
  const verificar = useMutation({ mutationFn: () => api<{ ok: boolean; ultimoNumero: number }>("/facturacion/verificar", { method: "POST" }), onSuccess: refrescar });
  const facturar = useMutation({
    mutationFn: ({ ventaId, receptor }: { ventaId: string; receptor: Receptor | null }) => api<Comprobante>(`/facturacion/ventas/${ventaId}`, { method: "POST", body: JSON.stringify({ receptor }) }),
    onSuccess: refrescar,
  });
  const notaCredito = useMutation({ mutationFn: (id: string) => api<Comprobante>(`/facturacion/comprobantes/${id}/nota-credito`, { method: "POST" }), onSuccess: refrescar });
  return { guardarConfig, verificar, facturar, notaCredito };
}

/** Abre el PDF del comprobante en otra pestaña. */
export async function abrirPdf(id: string, token: string | null) {
  const pdf = await apiArchivo(`/facturacion/comprobantes/${id}/pdf`, token);
  const url = URL.createObjectURL(pdf);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
