"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { apiArchivo } from "@/lib/api-client";

// Espejo de apps/api modules/archivo.
export type CategoriaArchivo = "factura_proveedor" | "contrato" | "habilitacion" | "seguro" | "constancia" | "otro";
export type EntidadArchivo = "empresa" | "proveedor" | "cliente" | "compra";

export interface DocumentoArchivo {
  id: string;
  titulo: string;
  categoria: CategoriaArchivo;
  entidadTipo: EntidadArchivo;
  entidadId: string | null;
  entidadNombre?: string | null;
  nombre: string;
  mime: string;
  tamano: number;
  vence: string | null;
  estado: "vencido" | "por_vencer" | "vigente" | null;
  diasParaVencer: number | null;
  notas: string | null;
  createdAt: string;
}

export const CATEGORIAS: { id: CategoriaArchivo; nombre: string }[] = [
  { id: "factura_proveedor", nombre: "Factura de proveedor" },
  { id: "contrato", nombre: "Contrato" },
  { id: "habilitacion", nombre: "Habilitación" },
  { id: "seguro", nombre: "Seguro" },
  { id: "constancia", nombre: "Constancia (ARCA, IIBB…)" },
  { id: "otro", nombre: "Otro" },
];
export const nombreCategoria = (id: string) => CATEGORIAS.find((c) => c.id === id)?.nombre ?? "Documento";

/** "2,4 MB" */
export function tamanoLegible(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString("es-AR", { maximumFractionDigits: 0 })} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / 1024 ** 3).toLocaleString("es-AR", { maximumFractionDigits: 2 })} GB`;
}

export function useArchivo(filtro: { entidadTipo?: EntidadArchivo; entidadId?: string; categoria?: string; q?: string }, habilitado = true) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const params = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v) as [string, string][]);
  return useQuery({ queryKey: ["archivo", "lista", params.toString(), orgId], queryFn: () => api<DocumentoArchivo[]>(`/archivo?${params}`), enabled: Boolean(orgId) && habilitado });
}

export function useUsoArchivo() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["archivo", "uso", orgId], queryFn: () => api<{ usado: number; limite: number; cantidad: number }>("/archivo/uso"), enabled: Boolean(orgId) });
}

export function usePorVencer(habilitado: boolean) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["archivo", "por-vencer", orgId], queryFn: () => api<DocumentoArchivo[]>("/archivo/por-vencer"), enabled: Boolean(orgId) && habilitado, staleTime: 10 * 60_000 });
}

export interface DatosDocumento {
  titulo?: string;
  categoria?: CategoriaArchivo;
  entidadTipo?: EntidadArchivo;
  entidadId?: string | null;
  vence?: string | null;
  notas?: string | null;
}

export function useAccionesArchivo() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["archivo"] });
  return {
    subir: useMutation({
      mutationFn: ({ archivo, ...datos }: DatosDocumento & { archivo: File }) => {
        const cuerpo = new FormData();
        cuerpo.append("archivo", archivo);
        for (const [k, v] of Object.entries(datos)) if (v != null && v !== "") cuerpo.append(k, String(v));
        return api<DocumentoArchivo>("/archivo", { method: "POST", body: cuerpo });
      },
      onSuccess: refrescar,
    }),
    editar: useMutation({ mutationFn: ({ id, ...d }: DatosDocumento & { id: string }) => api<DocumentoArchivo>(`/archivo/${id}`, { method: "PATCH", body: JSON.stringify(d) }), onSuccess: refrescar }),
    borrar: useMutation({ mutationFn: (id: string) => api(`/archivo/${id}`, { method: "DELETE" }), onSuccess: refrescar }),
  };
}

export async function bajarDocumento(id: string, token: string | null) {
  return apiArchivo(`/archivo/${id}/descargar`, token);
}
