"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFetch } from "@/hooks/use-api";
import type {
  CajaHistorialItem,
  EstadoCajaActiva,
  ResumenReporteXZ,
} from "../types/caja.types";

export const CAJA_KEYS = {
  activa: (orgId: string | null | undefined) => ["caja", "activa", orgId],
  historial: (orgId: string | null | undefined, filtros?: Record<string, unknown>) => [
    "caja",
    "historial",
    orgId,
    filtros,
  ],
  reporteX: (cajaId: string | null, orgId: string | null | undefined) => [
    "caja",
    "reporte-x",
    cajaId,
    orgId,
  ],
  reporteZ: (cajaId: string | null, orgId: string | null | undefined) => [
    "caja",
    "reporte-z",
    cajaId,
    orgId,
  ],
};

export function useCajaActiva() {
  const api = useApiFetch();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: CAJA_KEYS.activa(orgId),
    queryFn: () => api<EstadoCajaActiva>("/cajas/activa"),
    enabled: Boolean(orgId),
    refetchInterval: 15_000, // actualización en vivo cada 15 segundos
  });
}

export function useAbrirCaja() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: (datos: {
      montoInicial: number;
      nombreCaja?: string;
      ubicacionId?: string;
      notasApertura?: string;
    }) =>
      api("/cajas/abrir", {
        method: "POST",
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAJA_KEYS.activa(orgId) });
      queryClient.invalidateQueries({ queryKey: ["caja", "historial"] });
    },
  });
}

export function useRegistrarMovimiento() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: ({
      cajaId,
      tipo,
      monto,
      concepto,
      comprobanteRef,
    }: {
      cajaId: string;
      tipo: "ingreso" | "egreso";
      monto: number;
      concepto: string;
      comprobanteRef?: string;
    }) =>
      api(`/cajas/${cajaId}/movimientos`, {
        method: "POST",
        body: JSON.stringify({ tipo, monto, concepto, comprobanteRef }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAJA_KEYS.activa(orgId) });
    },
  });
}

export function useCerrarCaja() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: ({
      cajaId,
      montoDeclarado,
      notasCierre,
    }: {
      cajaId: string;
      montoDeclarado: number;
      notasCierre?: string;
    }) =>
      api<ResumenReporteXZ>(`/cajas/${cajaId}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ montoDeclarado, notasCierre }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAJA_KEYS.activa(orgId) });
      queryClient.invalidateQueries({ queryKey: ["caja", "historial"] });
    },
  });
}

export function useReporteX(cajaId: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: CAJA_KEYS.reporteX(cajaId, orgId),
    queryFn: () => api<ResumenReporteXZ>(`/cajas/${cajaId}/reporte-x`),
    enabled: Boolean(orgId && cajaId),
  });
}

export function useReporteZ(cajaId: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: CAJA_KEYS.reporteZ(cajaId, orgId),
    queryFn: () => api<ResumenReporteXZ>(`/cajas/${cajaId}/reporte-z`),
    enabled: Boolean(orgId && cajaId),
  });
}

export function useHistorialCajas(filtros?: { desde?: string; hasta?: string }) {
  const api = useApiFetch();
  const { orgId } = useAuth();

  const queryParams = new URLSearchParams();
  if (filtros?.desde) queryParams.set("desde", filtros.desde);
  if (filtros?.hasta) queryParams.set("hasta", filtros.hasta);
  const qs = queryParams.toString();

  return useQuery({
    queryKey: CAJA_KEYS.historial(orgId, filtros),
    queryFn: () => api<CajaHistorialItem[]>(`/cajas${qs ? `?${qs}` : ""}`),
    enabled: Boolean(orgId),
  });
}
