"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface CostoReceta {
  materiales: number;
  manoObra: number;
  total: number;
  sinCosto: number;
}

export interface RecetaFila {
  id: string;
  productoId: string;
  varianteId: string | null;
  nombre: string;
  armarAlVender: boolean;
  componentes: number;
  precio: number | null;
  /** null = sin permiso de ver costos. */
  costo: CostoReceta | null;
  margen: number | null;
}

export interface ComponenteReceta {
  insumoId: string;
  insumoVarianteId: string | null;
  cantidad: number;
  nombre: string;
  unidad: string;
  costoUnitario: number | null;
  stock: number;
  existe: boolean;
}

export interface RecetaDetalle {
  producto: { id: string; nombre: string; precio: number | null; variantes: { id: string; etiqueta: string }[] };
  receta: { id: string; minutos: number; armarAlVender: boolean; notas: string | null } | null;
  items: ComponenteReceta[];
  valorHora: number | null;
  costo: CostoReceta;
  margen: number | null;
}

export interface GuardarReceta {
  productoId: string;
  varianteId: string | null;
  minutos: number;
  armarAlVender: boolean;
  notas: string | null;
  items: { insumoId: string; insumoVarianteId: string | null; cantidad: number }[];
}

export interface LineaOrden {
  insumoId: string;
  insumoVarianteId: string | null;
  nombre: string;
  unidad: string;
  necesita: number;
  stock: number;
  falta: number;
  /** null = el usuario no tiene permiso de ver costos. */
  costoUnitario: number | null;
  costo: number | null;
}

export interface PreviaOrden {
  lineas: LineaOrden[];
  costoMateriales: number | null;
  costoManoObra: number | null;
  costoUnitario: number | null;
  faltan: number;
}

export interface OrdenFila {
  id: string;
  numero: number;
  fecha: string;
  producto: string;
  productoId: string;
  cantidad: number;
  costoMateriales: number | null;
  costoManoObra: number | null;
  costoUnitario: number | null;
  estado: "terminada" | "anulada";
  usuario: string | null;
  notas: string | null;
}

const INVALIDAR = ["recetas", "receta", "ordenes-produccion", "productos", "producto", "variantes", "kardex", "dashboard"];

function useGet<T>(clave: unknown[], ruta: string | null, extra: { anterior?: boolean } = {}) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: [...clave, orgId],
    queryFn: () => api<T>(ruta!),
    enabled: Boolean(orgId && ruta),
    placeholderData: extra.anterior ? keepPreviousData : undefined,
  });
}

export const useRecetas = () => useGet<RecetaFila[]>(["recetas"], "/produccion/recetas");
export const useOrdenes = () => useGet<OrdenFila[]>(["ordenes-produccion"], "/produccion/ordenes");
export const useReceta = (productoId: string | null, varianteId: string | null) =>
  useGet<RecetaDetalle>(["receta", productoId, varianteId], productoId ? `/produccion/receta?productoId=${productoId}${varianteId ? `&varianteId=${varianteId}` : ""}` : null);
export const usePreviaOrden = (productoId: string | null, varianteId: string | null, cantidad: number) =>
  useGet<PreviaOrden>(
    ["previa-orden", productoId, varianteId, cantidad],
    productoId && cantidad > 0 ? `/produccion/ordenes/previa?productoId=${productoId}&cantidad=${cantidad}${varianteId ? `&varianteId=${varianteId}` : ""}` : null,
    { anterior: true },
  );

export function useAccionesProduccion() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => {
    for (const k of INVALIDAR) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  return {
    guardarReceta: useMutation({ mutationFn: (r: GuardarReceta) => api<{ id: string }>("/produccion/receta", { method: "PUT", body: JSON.stringify(r) }), onSuccess: refrescar }),
    eliminarReceta: useMutation({ mutationFn: (id: string) => api(`/produccion/recetas/${id}`, { method: "DELETE" }), onSuccess: refrescar }),
    crearOrden: useMutation({
      mutationFn: (o: { productoId: string; varianteId: string | null; cantidad: number; ubicacion: string | null; notas: string | null; permitirFaltantes: boolean }) =>
        api<{ numero: number; costoUnitario: number | null }>("/produccion/ordenes", { method: "POST", body: JSON.stringify(o) }),
      onSuccess: refrescar,
    }),
    anularOrden: useMutation({ mutationFn: (id: string) => api(`/produccion/ordenes/${id}/anular`, { method: "POST" }), onSuccess: refrescar }),
  };
}
