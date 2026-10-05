"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { paramMoneda, useMoneda } from "@/lib/moneda";

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
  const moneda = useMoneda();
  return useQuery({
    queryKey: ["ganancia-productos", orgId, desde, hasta, moneda],
    queryFn: () => api<PeriodoRespuesta>(`/analytics/periodo?desde=${desde}&hasta=${hasta}&granularidad=mes${paramMoneda(moneda)}`),
    enabled: Boolean(orgId && desde && hasta),
    placeholderData: (anterior, consulta) => (consulta?.queryKey.at(-1) === moneda ? keepPreviousData(anterior) : undefined),
  });
}
