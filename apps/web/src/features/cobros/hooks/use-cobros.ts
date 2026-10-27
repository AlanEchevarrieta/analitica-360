"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFetch } from "@/hooks/use-api";

export type ProveedorPasarela = "mercadopago" | "uala" | "stripe";
export type EstadoTransaccion = "pendiente" | "aprobado" | "rechazado" | "expirado" | "reembolsado";
export type OrigenCobroTipo =
  | "pedido_tienda"
  | "venta_pos"
  | "cobro_cuenta_corriente"
  | "reserva_turno"
  | "abono"
  | "link_rapido";

export interface PasarelaConfigItem {
  proveedor: ProveedorPasarela;
  conectado: boolean;
  habilitado: boolean;
  publicKey: string | null;
  usoTienda: boolean;
  usoPos: boolean;
  usoCuentas: boolean;
  usoTurnos: boolean;
  conectadoEn: string | null;
  actualizadoEn: string | null;
}

export interface TransaccionItem {
  id: string;
  proveedor: ProveedorPasarela;
  origenTipo: OrigenCobroTipo;
  origenId: string | null;
  idExterno: string | null;
  urlPago: string | null;
  moneda: string;
  montoBruto: number;
  comisionEstimada: number;
  montoNeto: number | null;
  estado: EstadoTransaccion;
  clienteNombre: string | null;
  clienteEmail: string | null;
  concepto: string | null;
  pagadoEn: string | null;
  createdAt: string;
}

export interface MetricasCobros {
  periodo: string;
  totalBruto: number;
  totalComisiones: number;
  totalNeto: number;
  totalTransacciones: number;
  aprobadas: number;
  tasaAprobacion: number;
  porProveedor: Record<string, { total: number; comisiones: number; cantidad: number }>;
}

export interface GuardarPasarelaInput {
  proveedor: ProveedorPasarela;
  credenciales: Record<string, string>;
  publicKey?: string;
  webhookSecret?: string;
  usoTienda?: boolean;
  usoPos?: boolean;
  usoCuentas?: boolean;
  usoTurnos?: boolean;
}

export interface CrearCobroInput {
  monto: number;
  moneda?: string;
  concepto: string;
  proveedor: ProveedorPasarela;
  clienteNombre?: string;
  clienteEmail?: string;
  origenTipo?: OrigenCobroTipo;
  origenId?: string;
  urlVuelta?: string;
}

export function usePasarelasConfig() {
  const api = useApiFetch();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: ["pasarelas-config", orgId],
    queryFn: () => api<{ pasarelas: PasarelaConfigItem[] }>("/pasarelas/config"),
    enabled: Boolean(orgId),
  });
}

export function useGuardarPasarela() {
  const api = useApiFetch();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: GuardarPasarelaInput) =>
      api("/pasarelas/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pasarelas-config"] });
    },
  });
}

export function useDesconectarPasarela() {
  const api = useApiFetch();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (proveedor: ProveedorPasarela) =>
      api(`/pasarelas/config/${proveedor}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pasarelas-config"] });
    },
  });
}

export function useTransaccionesCobros(filtros?: {
  proveedor?: string;
  estado?: string;
  origenTipo?: string;
}) {
  const api = useApiFetch();
  const { orgId } = useAuth();

  const params = new URLSearchParams();
  if (filtros?.proveedor && filtros.proveedor !== "todos") params.append("proveedor", filtros.proveedor);
  if (filtros?.estado && filtros.estado !== "todos") params.append("estado", filtros.estado);
  if (filtros?.origenTipo && filtros.origenTipo !== "todos") params.append("origenTipo", filtros.origenTipo);

  const queryStr = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["pasarelas-transacciones", orgId, filtros],
    queryFn: () =>
      api<{ total: number; transacciones: TransaccionItem[] }>(`/pasarelas/transacciones${queryStr}`),
    enabled: Boolean(orgId),
    refetchInterval: 10_000, // actualización periódica para ver cobros en vivo
  });
}

export function useMetricasCobros() {
  const api = useApiFetch();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: ["pasarelas-metricas", orgId],
    queryFn: () => api<MetricasCobros>("/pasarelas/metricas"),
    enabled: Boolean(orgId),
  });
}

export function useCrearCobro() {
  const api = useApiFetch();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CrearCobroInput) =>
      api<{
        transaccionId: string;
        urlPago: string;
        idExterno?: string;
        qrData?: string | null;
        monto: number;
        moneda: string;
        estado: string;
      }>("/pasarelas/cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pasarelas-transacciones"] });
      void qc.invalidateQueries({ queryKey: ["pasarelas-metricas"] });
    },
  });
}
