"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface FilaKardex {
  id: string;
  fecha: string;
  tipo: string;
  varianteId: string | null;
  varianteEtiqueta: string | null;
  motivo: string | null;
  comprobante: string | null;
  usuario: string | null;
  entrada: number;
  salida: number;
  costoUnitario: number;
  valor: number;
  saldoCantidad: number;
  costoPromedio: number;
  saldoValor: number;
  diferenciaValuacion: number;
}

interface Total {
  cantidad: number;
  valor: number;
}

/** GET /inventario/kardex/:productoId — kardex valorizado por costo promedio ponderado. */
export interface Kardex {
  producto: { id: string; nombre: string; costo: number | null; sku: string | null };
  variantes: { id: string; etiqueta: string }[];
  inicial: Total & { costoPromedio: number };
  entradas: Total;
  salidas: Total;
  perdidas: Total;
  diferenciaValuacion: number;
  stockNegativo: boolean;
  final: Total & { costoPromedio: number };
  filas: FilaKardex[];
}

export interface Perdidas {
  total: number;
  porTipo: { tipo: string; cantidad: number; valor: number }[];
  porProducto: { productoId: string; nombre: string; cantidad: number; valor: number }[];
}

export const TIPOS_AJUSTE = [
  { valor: "merma", etiqueta: "Merma / vencido", salida: true },
  { valor: "rotura", etiqueta: "Rotura", salida: true },
  { valor: "perdida", etiqueta: "Pérdida o robo", salida: true },
  { valor: "consumo_interno", etiqueta: "Consumo interno / regalo", salida: true },
  { valor: "ajuste_negativo", etiqueta: "Faltante en recuento", salida: true },
  { valor: "ajuste_positivo", etiqueta: "Sobrante en recuento", salida: false },
] as const;
export type TipoAjuste = (typeof TIPOS_AJUSTE)[number]["valor"];

/** Nombre para mostrar de cada tipo de movimiento (según entre o salga). */
export function etiquetaMovimiento(tipo: string, entra: boolean) {
  const ajuste = TIPOS_AJUSTE.find((t) => t.valor === tipo);
  if (ajuste) return ajuste.etiqueta;
  const nombres: Record<string, [string, string]> = {
    venta: ["Venta (reingreso)", "Venta"],
    compra: ["Compra", "Compra anulada"],
    anulacion: ["Venta anulada", "Anulación"],
    devolucion_cliente: ["Devolución de cliente", "Devolución (salida)"],
    devolucion_proveedor: ["Devolución de proveedor", "Devolución a proveedor"],
    cambio: ["Cambio (entra)", "Cambio (sale)"],
    pedido: ["Pedido (reingreso)", "Pedido"],
  };
  const n = nombres[tipo];
  return n ? n[entra ? 0 : 1] : tipo;
}

export function useKardex(productoId: string, desde: string, hasta: string, varianteId: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const q = new URLSearchParams({ desde, hasta, ...(varianteId ? { varianteId } : {}) });
  return useQuery({
    queryKey: ["kardex", orgId, productoId, desde, hasta, varianteId],
    queryFn: () => api<Kardex>(`/inventario/kardex/${productoId}?${q}`),
    enabled: Boolean(orgId),
    placeholderData: (previo) => previo,
  });
}

export function usePerdidas(desde: string, hasta: string, habilitado = true) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["perdidas", orgId, desde, hasta],
    queryFn: () => api<Perdidas>(`/inventario/perdidas?desde=${desde}&hasta=${hasta}`),
    enabled: Boolean(orgId) && habilitado,
  });
}

export interface AjusteInput {
  productoId: string;
  varianteId: string | null;
  tipo: TipoAjuste;
  cantidad: number;
  motivo: string | null;
  ubicacion: string | null;
}

/** POST /inventario/movimientos/ajuste (merma, rotura, recuento…). */
export function useRegistrarAjuste() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AjusteInput) => api("/inventario/movimientos/ajuste", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      for (const k of ["kardex", "perdidas", "productos", "producto", "variantes", "dashboard", "contabilidad", "estados-contables"]) {
        void queryClient.invalidateQueries({ queryKey: [k] });
      }
    },
  });
}
