"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

/** Fila de `productos` de GET /analytics/periodo: total ya neto de descuentos, costo al momento de cada venta (PPP). */
export interface GananciaProducto {
  producto: string;
  unidades: number;
  total: number;
  costo: number;
  margen: number;
  margenPct: number;
}

interface PeriodoRespuesta {
  avisoLimite: number | null;
  data: { productos: GananciaProducto[] } | null;
}

export function useGananciaProductos(desde: string, hasta: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["ganancia-productos", orgId, desde, hasta],
    queryFn: () => api<PeriodoRespuesta>(`/analytics/periodo?desde=${desde}&hasta=${hasta}&granularidad=mes`),
    enabled: Boolean(orgId && desde && hasta),
    placeholderData: keepPreviousData,
  });
}
