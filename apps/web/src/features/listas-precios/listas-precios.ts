"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlan } from "@/hooks/use-plan";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

/** Lista de precios (ej. Mayorista -15%): ajuste sobre el precio de venta normal. */
export interface ListaPrecio {
  id: string;
  nombre: string;
  ajustePct: number;
  redondeo: number;
  clientes: number;
}
export type DatosListaPrecio = Pick<ListaPrecio, "nombre" | "ajustePct" | "redondeo">;

export const REDONDEOS_LISTA = [
  { valor: 0, etiqueta: "Sin redondear" },
  { valor: 10, etiqueta: "A $10" },
  { valor: 50, etiqueta: "A $50" },
  { valor: 100, etiqueta: "A $100" },
  { valor: 500, etiqueta: "A $500" },
  { valor: 1000, etiqueta: "A $1.000" },
];

/** Precio con la lista aplicada (redondeo hacia arriba, igual que el aumento masivo). */
export function precioConLista(base: number, lista: Pick<ListaPrecio, "ajustePct" | "redondeo"> | null | undefined): number {
  if (!lista || !(base > 0)) return base;
  const bruto = Math.round(base * (1 + lista.ajustePct / 100) * 100) / 100;
  return lista.redondeo > 0 ? Math.ceil(bruto / lista.redondeo) * lista.redondeo : bruto;
}

/** "15% menos" / "10% más". */
export function etiquetaAjuste(pct: number) {
  return `${Math.abs(pct).toLocaleString("es-AR")}% ${pct < 0 ? "menos" : "más"}`;
}

export function useListasPrecios() {
  // Las listas son del plan Pro: sin él, ni se piden (la API respondería 403).
  const { incluye } = usePlan();
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["listas-precios", orgId],
    queryFn: () => api<ListaPrecio[]>("/listas-precios"),
    enabled: Boolean(orgId) && incluye("listas_precios"),
    staleTime: 5 * 60_000,
  });
}

export function useGuardarListaPrecio() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string | null; datos: DatosListaPrecio }) =>
      api<ListaPrecio[]>(id ? `/listas-precios/${id}` : "/listas-precios", { method: id ? "PUT" : "POST", body: JSON.stringify(datos) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["listas-precios"] }),
  });
}

export function useEliminarListaPrecio() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ListaPrecio[]>(`/listas-precios/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["listas-precios"] });
      // Sus clientes vuelven al precio normal.
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
