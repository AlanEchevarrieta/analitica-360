"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de GET /inventario/movimientos (apps/api modules/inventario/movimientos-generales.service.ts).
export type GrupoMovimiento = "ventas" | "compras" | "devoluciones" | "ajustes" | "traslados" | "produccion";

export interface FilaMovimiento {
  id: string;
  fecha: string;
  productoId: string;
  producto: string;
  variante: string | null;
  tipo: string;
  tipoNombre: string;
  sentido: "entra" | "sale" | "traslado";
  cantidad: number;
  costoUnitario: number | null;
  valor: number | null;
  ubicacionOrigen: string | null;
  ubicacionDestino: string | null;
  origen: { texto: string; ruta: string | null } | null;
  motivo: string | null;
  usuario: string | null;
}

export interface RespuestaMovimientos {
  total: number;
  pagina: number;
  pageSize: number;
  verCostos: boolean;
  totales: { entradas: { cantidad: number; valor: number | null }; salidas: { cantidad: number; valor: number | null }; traslados: number };
  items: FilaMovimiento[];
}

export interface FiltrosMovimientos {
  desde: string;
  hasta: string;
  grupo: GrupoMovimiento | "";
  ubicacion: string;
  busqueda: string;
  pagina: number;
}

export const GRUPOS: { valor: GrupoMovimiento | ""; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todos" },
  { valor: "ventas", etiqueta: "Ventas" },
  { valor: "compras", etiqueta: "Compras" },
  { valor: "devoluciones", etiqueta: "Devoluciones" },
  { valor: "ajustes", etiqueta: "Ajustes y pérdidas" },
  { valor: "traslados", etiqueta: "Traslados" },
  { valor: "produccion", etiqueta: "Producción" },
];

export function consultaMovimientos(f: Omit<FiltrosMovimientos, "pagina">, pagina: number, pageSize: number) {
  const q = new URLSearchParams({ desde: f.desde, hasta: f.hasta, pagina: String(pagina), pageSize: String(pageSize) });
  if (f.grupo) q.set("grupo", f.grupo);
  if (f.ubicacion) q.set("ubicacion", f.ubicacion);
  if (f.busqueda.trim()) q.set("busqueda", f.busqueda.trim());
  return `/inventario/movimientos?${q}`;
}

export const POR_PAGINA = 50;

export function useMovimientos(f: FiltrosMovimientos) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["movimientos", orgId, f],
    queryFn: () => api<RespuestaMovimientos>(consultaMovimientos(f, f.pagina, POR_PAGINA)),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}

export function useUbicacionesMovimientos() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["movimientos-ubicaciones", orgId], queryFn: () => api<string[]>("/inventario/movimientos/ubicaciones"), enabled: Boolean(orgId), staleTime: 5 * 60_000 });
}
