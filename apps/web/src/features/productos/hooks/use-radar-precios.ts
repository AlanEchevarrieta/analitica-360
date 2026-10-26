"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface ItemMercado {
  titulo: string;
  precio: number;
  moneda: string;
  vendedor: string;
  url: string;
  fuente: "mercadolibre" | "tienda_competidor" | "google";
  reputacionVendedor?: string;
  stock?: number;
  condicion?: string;
  foto?: string;
}

export interface MetricasMercado {
  precioMinimo: number;
  precioMediana: number;
  precioPromedio: number;
  precioMaximo: number;
  muestraTotal: number;
  muestraFiltrada: number;
  brechaPorcentaje: number;
  estadoCompetitivo: "alineado" | "barato_margen_recuperable" | "caro_fuera_de_mercado";
  items: ItemMercado[];
}

export interface ResultadoBenchmarkProducto {
  productoId: string;
  nombre: string;
  codigoBarra: string | null;
  sku: string | null;
  precioLocal: number;
  costoLocal: number | null;
  metricas: MetricasMercado;
  fechaEscaneo: string;
  fuentePrincipal: string;
}

export function useComparativasRadar() {
  const api = useApiFetch();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: ["radar-precios", orgId],
    queryFn: () => api<ResultadoBenchmarkProducto[]>("/radar-precios/comparativas"),
    enabled: Boolean(orgId),
  });
}

export function useEscanearProducto() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: (productoId: string) =>
      api<ResultadoBenchmarkProducto>(`/radar-precios/escanear/${productoId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-precios", orgId] });
      queryClient.invalidateQueries({ queryKey: ["copilot-insights", orgId] });
    },
  });
}

export function useEscanearLote() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: (body?: { limite?: number; soloConCodigoBarra?: boolean }) =>
      api<ResultadoBenchmarkProducto[]>("/radar-precios/escanear-lote", {
        method: "POST",
        body: JSON.stringify(body ?? { limite: 15 }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-precios", orgId] });
      queryClient.invalidateQueries({ queryKey: ["copilot-insights", orgId] });
    },
  });
}

export function useAlinearPrecio() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: ({
      productoId,
      nuevoPrecio,
      motivo,
    }: {
      productoId: string;
      nuevoPrecio: number;
      motivo?: string;
    }) =>
      api<{ productoId: string; precioAnterior: number; precioNuevo: number }>(
        `/radar-precios/alinear/${productoId}`,
        {
          method: "POST",
          body: JSON.stringify({ nuevoPrecio, motivo }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-precios", orgId] });
      queryClient.invalidateQueries({ queryKey: ["productos", orgId] });
    },
  });
}
