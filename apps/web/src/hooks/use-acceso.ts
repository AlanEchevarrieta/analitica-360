"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { tieneModulo, type ModuloClave } from "@/lib/rol";
import { useRol } from "@/hooks/use-rol";

export type AccionClave =
  | "registrar_ventas"
  | "crear_pedidos"
  | "hacer_picking"
  | "editar_productos"
  | "ver_costos"
  | "anular_ventas"
  | "importar_datos"
  | "ver_reportes"
  | "gestionar_clientes";

interface MiAcceso {
  rol: string;
  modulos: ModuloClave[];
  acciones: AccionClave[];
}

/**
 * Qué puede ver el usuario en la empresa activa (GET /usuarios/yo: rol +
 * permisos del colaborador). Solo para no mostrar ni pedir lo que la API
 * igual rechaza. Mientras carga, se decide por rol: el dueño ve todo, el
 * contador sus módulos fijos y el operador nada (como la API).
 */
export function useAcceso() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const rol = useRol();
  const { data } = useQuery({
    queryKey: ["mi-acceso", orgId],
    queryFn: () => api<MiAcceso>("/usuarios/yo"),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
  return {
    cargado: Boolean(data) || rol === "dueno",
    puede: (modulo: ModuloClave) => (data ? data.modulos.includes(modulo) || (modulo === "soporte") : tieneModulo(rol, modulo)),
    puedeHacer: (accion: AccionClave) => (data ? data.acciones.includes(accion) : rol === "dueno"),
  };
}
