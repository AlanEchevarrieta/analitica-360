"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface TasaCuota {
  cuotas: number;
  tasa: number;
  label: string;
  activo: boolean;
  personalizada: boolean;
}

export interface Configuracion {
  /** Costo de una hora de trabajo (Producción). */
  valorHora: number | null;
  mediosPago: string[];
  tasasCuotas: TasaCuota[];
  mostrarCliente: "siempre" | "opcional" | "no_mostrar";
  crearClienteDesdeVenta: boolean;
  umbralStockBajo: number;
  ubicacionVentaDefault: string | null;
  remitente: { nombre: string | null; direccion: string | null; telefono: string | null; email: string | null };
  modoAsignacion: "manual" | "round_robin" | "todo_a_uno";
  asignacionFijaUsuarioId: string | null;
  asignacionRotacionIds: string[];
  pais: string;
  moneda: string;
  simboloMoneda: string;
  alicuotaIva: number;
  nombreIva: string;
  mostrarIvaVentas: boolean;
  condicionFiscal: string;
  categoriaMonotributo: string | null;
  /** Dólar para ver los reportes en US$: blue | oficial | bolsa (MEP). */
  dolarTipo: string;
}

export interface Ubicacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: "deposito" | "local" | "stand" | "feria" | "otro";
  activo: boolean;
}

export interface CategoriaConfig {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface AtributoConfig {
  id: string;
  nombre: string;
  valores: string[];
  activoVentas: boolean;
}

export function useConfiguracion() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["configuracion", orgId], queryFn: () => api<Configuracion>("/configuracion"), enabled: Boolean(orgId) });
}

/** Guardado parcial: cada sección manda solo lo suyo. Refresca todo lo que depende de la configuración. */
export function useGuardarConfiguracion() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: Partial<Configuracion>) => api<Configuracion>("/configuracion", { method: "PATCH", body: JSON.stringify(cambios) }),
    onSuccess: () => {
      for (const k of ["configuracion", "ventas-configuracion", "dashboard", "pedidos-remitente", "monotributo", "dolar-hoy", "periodo", "rendimiento", "contabilidad", "ganancia-productos"]) void queryClient.invalidateQueries({ queryKey: [k] });
    },
  });
}

/** CRUD genérico de las listas de configuración (ubicaciones, categorías, atributos). */
export function useListaConfig<T extends { id: string }>(recurso: "ubicaciones" | "categorias" | "atributos") {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const ruta = recurso === "atributos" ? "/atributos" : `/${recurso}?soloActivas=false`;
  const lista = useQuery({ queryKey: [`config-${recurso}`, orgId], queryFn: () => api<T[]>(ruta), enabled: Boolean(orgId) });
  const onSuccess = () => {
    // Otras pantallas usan estas listas con sus propias claves (venta, producto, stock).
    for (const k of [`config-${recurso}`, recurso, "productos", "configuracion"]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const guardar = useMutation({
    mutationFn: ({ id, datos }: { id: string | null; datos: Omit<T, "id"> }) =>
      api<T>(id ? `/${recurso}/${id}` : `/${recurso}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(datos) }),
    onSuccess,
  });
  const eliminar = useMutation({ mutationFn: (id: string) => api(`/${recurso}/${id}`, { method: "DELETE" }), onSuccess });
  return { lista, guardar, eliminar };
}
