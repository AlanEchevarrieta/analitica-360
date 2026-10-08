"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { usePlan } from "@/hooks/use-plan";

// Espejo de apps/api/src/modules/objetivos (objetivos.util.ts y objetivos.service.ts).
export type TipoObjetivo = "facturacion" | "ganancia" | "produccion" | "despachos" | "dias_despacho" | "a_tiempo" | "clientes_nuevos" | "ticket_promedio" | "unidades" | "cobranza";
export type PeriodoObjetivo = "semana" | "mes" | "trimestre" | "anio";
export type Semaforo = "bien" | "justo" | "mal" | "sin_datos";

export interface Avance {
  desde: string;
  hasta: string;
  /** Meta de ese período (la propia si tiene, si no la general). */
  meta: number;
  valor: number | null;
  porcentaje: number | null;
  esperado: number | null;
  proyeccion: number | null;
  semaforo: Semaforo;
}

export interface Objetivo {
  id: string;
  tipo: TipoObjetivo;
  periodo: PeriodoObjetivo;
  meta: number;
  moneda: "ARS" | "USD";
  ubicacion: string | null;
  usuario: { id: string; nombre: string } | null;
  producto: { id: string; nombre: string } | null;
  actual: Avance;
  historial: Avance[];
  metasPeriodo: { desde: string; meta: number }[];
}

export interface AvisoObjetivo {
  id: string;
  objetivoId: string;
  mensaje: string;
  creadoEn: string;
}

export interface GuardarObjetivo {
  tipo: TipoObjetivo;
  periodo: PeriodoObjetivo;
  meta: number;
  moneda: "ARS" | "USD";
  ubicacion: string | null;
  usuarioId: string | null;
  productoId: string | null;
}

export interface OpcionesObjetivo {
  avanzados: boolean;
  ubicaciones: string[];
  usuarios: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}

export function useObjetivos() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { disponible } = usePlan();
  return useQuery({
    queryKey: ["objetivos", orgId],
    queryFn: () => api<Objetivo[]>("/objetivos"),
    enabled: Boolean(orgId) && disponible("objetivos"),
  });
}

export function useOpcionesObjetivo(habilitado: boolean) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["objetivos-opciones", orgId],
    queryFn: () => api<OpcionesObjetivo>("/objetivos/opciones"),
    enabled: Boolean(orgId) && habilitado,
  });
}

export function useAccionesObjetivo() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const onSuccess = () => void queryClient.invalidateQueries({ queryKey: ["objetivos"] });
  const guardar = useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: GuardarObjetivo }) =>
      api(id ? `/objetivos/${id}` : "/objetivos", { method: id ? "PATCH" : "POST", body: JSON.stringify(datos) }),
    onSuccess,
  });
  const borrar = useMutation({ mutationFn: (id: string) => api(`/objetivos/${id}`, { method: "DELETE" }), onSuccess });
  const fijarMeta = useMutation({
    mutationFn: ({ id, desde, meta }: { id: string; desde: string; meta: number | null }) => api(`/objetivos/${id}/metas`, { method: "PUT", body: JSON.stringify({ desde, meta }) }),
    onSuccess,
  });
  return { guardar, borrar, fijarMeta };
}

export function useAvisosObjetivos() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { disponible } = usePlan();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ["objetivos-avisos", orgId],
    queryFn: () => api<AvisoObjetivo[]>("/objetivos/avisos"),
    enabled: Boolean(orgId) && disponible("objetivos"),
  });
  const leido = useMutation({
    mutationFn: (id: string) => api(`/objetivos/avisos/${id}/leido`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["objetivos-avisos"] }),
  });
  return { ...consulta, leido };
}
