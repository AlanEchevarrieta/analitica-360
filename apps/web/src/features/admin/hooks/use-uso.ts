"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/uso/uso.service.ts.
export interface FiltrosUso {
  dias: 1 | 7 | 30 | 90;
  empresaId: string;
  conAdmins: boolean;
}

export interface ResumenUso {
  totales: { usuarios: number; empresas: number; sesiones: number; vistas: number; clics: number };
  porDia: { dia: string; usuarios: number; vistas: number; clics: number }[];
  pantallas: { ruta: string; vistas: number; usuarios: number; empresas: number }[];
  clics: { objetivo: string; ruta: string; veces: number; usuarios: number }[];
  usuarios: { id: string; nombre: string; email: string; empresa: string; vistas: number; clics: number; sesiones: number; dias: number; ultima: string; dispositivo: string | null }[];
  dispositivos: { dispositivo: string; usuarios: number; eventos: number }[];
}

export interface UsoDeUsuario {
  usuario: { id: string; nombre: string; email: string; rol: string; empresa: string } | null;
  pantallas: { ruta: string; vistas: number }[];
  clics: { objetivo: string; ruta: string; veces: number }[];
  recientes: { tipo: "vista" | "clic"; ruta: string; objetivo: string | null; dispositivo: string | null; fecha: string }[];
}

const consulta = (f: Pick<FiltrosUso, "dias"> & Partial<FiltrosUso>) => {
  const q = new URLSearchParams({ dias: String(f.dias), conAdmins: String(Boolean(f.conAdmins)) });
  if (f.empresaId) q.set("empresaId", f.empresaId);
  return q.toString();
};

export function useResumenUso(f: FiltrosUso) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["admin", "uso", f, orgId],
    queryFn: () => api<ResumenUso>(`/admin/uso?${consulta(f)}`),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}

export function useUsoDeUsuario(id: string, dias: FiltrosUso["dias"]) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["admin", "uso-usuario", id, dias, orgId],
    queryFn: () => api<UsoDeUsuario>(`/admin/uso/usuarios/${id}?${consulta({ dias })}`),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
}

/** Nombre de cada pantalla para leer el tablero sin mirar rutas. */
const PANTALLAS: Record<string, string> = {
  "/inicio": "Inicio",
  "/ventas": "Ventas",
  "/ventas/nueva": "Nueva venta",
  "/ventas/:id": "Detalle de venta",
  "/ventas/devoluciones": "Devoluciones",
  "/productos": "Productos",
  "/productos/nuevo": "Nuevo producto",
  "/productos/:id": "Ficha de producto",
  "/inventario": "Inventario (stock)",
  "/inventario/movimientos": "Inventario (movimientos)",
  "/inventario/:id": "Kardex de producto",
  "/compras": "Compras",
  "/compras/nueva": "Nueva compra",
  "/pedidos": "Pedidos",
  "/pedidos/nuevo": "Nuevo pedido",
  "/pedidos/:id": "Detalle de pedido",
  "/clientes": "Clientes",
  "/clientes/nuevo": "Nuevo cliente",
  "/clientes/segmentos": "Segmentos de clientes",
  "/clientes/:id": "Ficha de cliente",
  "/proveedores": "Proveedores",
  "/produccion": "Producción",
  "/analytics/ventas": "Analytics · ventas",
  "/analytics/productos": "Analytics · productos",
  "/analytics/contabilidad": "Analytics · contabilidad",
  "/analytics/insights": "Analytics · insights",
  "/analytics/estados": "Analytics · estados",
  "/configuracion": "Configuración",
  "/planes": "Planes",
  "/soporte": "Soporte",
  "/soporte/nuevo": "Nuevo ticket",
};
export const nombrePantalla = (ruta: string) => PANTALLAS[ruta] ?? ruta;
