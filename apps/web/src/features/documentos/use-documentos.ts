"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { apiArchivo } from "@/lib/api-client";

// Espejo de apps/api modules/documentos.
export type TipoDocumento = "venta" | "recibo" | "presupuesto";

export interface ConfigDocumentos {
  logoUrl: string | null;
  /** Logo de la tienda online: se usa si no hay uno propio de los documentos. */
  logoTienda: string | null;
  pie: string | null;
  validezPresupuestoDias: number;
}

export interface LinkDocumento {
  url: string;
  vence: string;
  mensaje: string;
  telefono: string | null;
  whatsapp: string;
}

export interface CobroDeVenta {
  id: string;
  fecha: string;
  monto: number;
  formaPago: string;
  recibo: string | null;
}

export function useConfigDocumentos() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["documentos", "config", orgId], queryFn: () => api<ConfigDocumentos>("/documentos/config"), enabled: Boolean(orgId) });
}

export function useCobrosDeVenta(ventaId: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["documentos", "cobros", ventaId, orgId], queryFn: () => api<CobroDeVenta[]>(`/documentos/venta/${ventaId}/cobros`), enabled: Boolean(orgId && ventaId) });
}

export function useAccionesDocumentos() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["documentos"] });
  return {
    guardarConfig: useMutation({ mutationFn: (d: { pie?: string | null; validezPresupuestoDias?: number }) => api<ConfigDocumentos>("/documentos/config", { method: "PATCH", body: JSON.stringify(d) }), onSuccess: refrescar }),
    logo: useMutation({
      mutationFn: (archivo: File | null) => {
        if (!archivo) return api<ConfigDocumentos>("/documentos/config/logo", { method: "DELETE" });
        const cuerpo = new FormData();
        cuerpo.append("archivo", archivo);
        return api<ConfigDocumentos>("/documentos/config/logo", { method: "POST", body: cuerpo });
      },
      onSuccess: refrescar,
    }),
    link: useMutation({ mutationFn: ({ tipo, id }: { tipo: TipoDocumento; id: string }) => api<LinkDocumento>(`/documentos/${tipo}/${id}/link`, { method: "POST" }), onSuccess: refrescar }),
    email: useMutation({
      mutationFn: ({ tipo, id, email }: { tipo: TipoDocumento; id: string; email: string | null }) => api<{ para: string }>(`/documentos/${tipo}/${id}/email`, { method: "POST", body: JSON.stringify({ email }) }),
      onSuccess: refrescar,
    }),
  };
}

/** Descarga el PDF con la sesión (el recibo recibe su número la primera vez). */
export async function pdfDocumento(tipo: TipoDocumento, id: string, token: string | null): Promise<Blob> {
  return apiArchivo(`/documentos/${tipo}/${id}/pdf`, token);
}
