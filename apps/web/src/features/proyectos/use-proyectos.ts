"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export type EstadoProyecto = "activo" | "pausado" | "terminado" | "cancelado";
export type EstadoEtapa = "pendiente" | "en_curso" | "en_revision" | "aprobada" | "omitida";
export type TipoAprobacion = "ninguna" | "interna" | "cliente" | "ambas";
export type FaltaAprobacion = "interna" | "cliente" | null;

export const NOMBRE_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: "Activo",
  pausado: "Pausado",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

export const COLOR_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pausado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  terminado: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  cancelado: "bg-muted text-muted-foreground",
};

export const NOMBRE_ESTADO_ETAPA: Record<EstadoEtapa, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  omitida: "Omitida",
};

export const NOMBRE_APROBACION: Record<TipoAprobacion, string> = {
  ninguna: "Sin aprobación",
  interna: "Interna",
  cliente: "Cliente",
  ambas: "Interna y después cliente",
};

export interface ProyectoFila {
  id: string;
  numero: number;
  codigo: string;
  nombre: string;
  clienteId: string | null;
  clienteNombre: string | null;
  estado: EstadoProyecto;
  responsableId: string | null;
  responsableNombre: string | null;
  plantillaId: string | null;
  plantillaNombre: string | null;
  fechaInicio: string;
  fechaComprometida: string | null;
  montoAcordado: number | null;
  etapaActual: {
    orden: number;
    nombre: string;
    estado: EstadoEtapa;
    falta: FaltaAprobacion;
    atrasada: boolean;
  } | null;
  esperandoCliente: boolean;
  diasEsperandoCliente: number;
  atrasado: boolean;
  diasAtraso: number;
  avance: { cerradas: number; total: number; porcentaje: number };
  maxVersion: number;
}

export interface TableroProyectosResp {
  columnas: { nombre: string; proyectos: ProyectoFila[] }[];
  total: number;
}

export interface MetricasProyectosResp {
  terminados: number;
  aTiempoPorcentaje: number;
  atrasoPromedioDias: number;
  porEtapa: {
    nombre: string;
    cantidad: number;
    diasTrabajoPromedio: number;
    diasEsperaPromedio: number;
    rondasCambiosPromedio: number;
  }[];
  etapaMasDemorada: { nombre: string; diasEsperaPromedio: number } | null;
}

export interface ProyectoAprobacionItem {
  id: string;
  tipo: "interna" | "cliente";
  resultado: "aprobada" | "cambios";
  version: number;
  aprobadorUsuarioId: string | null;
  aprobadorNombre: string;
  medio: string;
  comentario: string | null;
  evidenciaUrl: string | null;
  aprobadoEn: string;
  registradoPorId: string;
  registradoPorNombre: string;
}

export interface ProyectoEtapaItem {
  id: string;
  orden: number;
  nombre: string;
  estado: EstadoEtapa;
  aprobacion: TipoAprobacion;
  falta: FaltaAprobacion;
  responsableId: string | null;
  responsableNombre: string | null;
  aprobadorInternoId: string | null;
  aprobadorInternoNombre: string | null;
  fechaObjetivo: string | null;
  atrasada: boolean;
  version: number;
  iniciadaEn: string | null;
  enRevisionDesde: string | null;
  cerradaEn: string | null;
  minutosTrabajo: number;
  minutosEspera: number;
  rondasCambios: number;
  esActual: boolean;
  aprobaciones: ProyectoAprobacionItem[];
}

export interface ProyectoEventoItem {
  id: string;
  etapaId: string | null;
  tipo: string;
  detalle: Record<string, unknown> | null;
  usuarioId: string | null;
  usuarioNombre: string;
  createdAt: string;
}

export interface ProyectoDetalle extends ProyectoFila {
  negocioNombre: string | null;
  clienteTelefono: string | null;
  descripcion: string | null;
  presupuestoId: string | null;
  terminadoEn: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  miembros: { usuarioId: string; nombre: string }[];
  etapas: ProyectoEtapaItem[];
  eventos: ProyectoEventoItem[];
}

export interface PlantillaProyecto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  etapas: {
    id: string;
    orden: number;
    nombre: string;
    diasObjetivo: number | null;
    aprobacion: TipoAprobacion;
    aprobadorInternoId: string | null;
  }[];
}

export interface FiltrosProyectos {
  estado?: string;
  responsableId?: string;
  clienteId?: string;
  atrasados?: boolean;
}

function armarQs(f: FiltrosProyectos = {}) {
  const p = new URLSearchParams();
  if (f.estado) p.set("estado", f.estado);
  if (f.responsableId) p.set("responsableId", f.responsableId);
  if (f.clienteId) p.set("clienteId", f.clienteId);
  if (f.atrasados) p.set("atrasados", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

function useConsulta<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["proyectos", ...clave, orgId],
    queryFn: () => api<T>(ruta!),
    enabled: Boolean(orgId && ruta),
  });
}

export const useProyectos = (filtros: FiltrosProyectos = {}) =>
  useConsulta<ProyectoFila[]>(["lista", filtros], `/proyectos${armarQs(filtros)}`);

export const useTableroProyectos = (filtros: FiltrosProyectos = {}) =>
  useConsulta<TableroProyectosResp>(["tablero", filtros], `/proyectos/tablero${armarQs(filtros)}`);

export const useMetricasProyectos = (desde?: string, hasta?: string) => {
  const p = new URLSearchParams();
  if (desde) p.set("desde", desde);
  if (hasta) p.set("hasta", hasta);
  const qs = p.toString();
  return useConsulta<MetricasProyectosResp>(["metricas", desde ?? "", hasta ?? ""], `/proyectos/metricas${qs ? `?${qs}` : ""}`);
};

export const useProyecto = (id: string) =>
  useConsulta<ProyectoDetalle>(["ficha", id], `/proyectos/${id}`);

export const useResponsablesProyecto = () =>
  useConsulta<{ id: string; nombre: string; email: string; rol: string }[]>(["responsables"], "/proyectos/responsables");

export const usePlantillasProyecto = () =>
  useConsulta<PlantillaProyecto[]>(["plantillas"], "/plantillas-proyecto");

export function useAccionesProyecto() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["proyectos"] });
    void queryClient.invalidateQueries({ queryKey: ["presupuestos"] });
  };
  const enviar = <T,>(ruta: string, body: unknown, method = "POST") =>
    api<T>(ruta, { method, body: JSON.stringify(body) });

  return {
    crear: useMutation({
      mutationFn: (body: unknown) => enviar<ProyectoDetalle>("/proyectos", body),
      onSuccess: refrescar,
    }),
    desdePresupuesto: useMutation({
      mutationFn: ({ presupuestoId, ...body }: { presupuestoId: string } & Record<string, unknown>) =>
        enviar<ProyectoDetalle>(`/proyectos/desde-presupuesto/${presupuestoId}`, body),
      onSuccess: refrescar,
    }),
    editar: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        enviar<ProyectoDetalle>(`/proyectos/${id}`, body, "PUT"),
      onSuccess: refrescar,
    }),
    editarEtapa: useMutation({
      mutationFn: ({
        proyectoId,
        etapaId,
        ...body
      }: {
        proyectoId: string;
        etapaId: string;
        responsableId?: string | null;
        aprobadorInternoId?: string | null;
        fechaObjetivo?: string | null;
      }) => enviar<ProyectoDetalle>(`/proyectos/${proyectoId}/etapas/${etapaId}`, body, "PUT"),
      onSuccess: refrescar,
    }),
    agregarEtapa: useMutation({
      mutationFn: ({
        proyectoId,
        ...body
      }: {
        proyectoId: string;
        nombre: string;
        aprobacion?: TipoAprobacion;
        responsableId?: string | null;
        fechaObjetivo?: string | null;
        orden?: number;
      }) => enviar<ProyectoDetalle>(`/proyectos/${proyectoId}/etapas`, body),
      onSuccess: refrescar,
    }),
    accionEtapa: useMutation({
      mutationFn: ({
        proyectoId,
        etapaId,
        accion,
        nota,
      }: {
        proyectoId: string;
        etapaId: string;
        accion: "empezar" | "enviar_revision" | "terminar" | "omitir";
        nota?: string | null;
      }) => enviar<ProyectoDetalle>(`/proyectos/${proyectoId}/etapas/${etapaId}/accion`, { accion, nota }),
      onSuccess: refrescar,
    }),
    aprobacionInterna: useMutation({
      mutationFn: ({
        proyectoId,
        etapaId,
        resultado,
        version,
        comentario,
      }: {
        proyectoId: string;
        etapaId: string;
        resultado: "aprobada" | "cambios";
        version: number;
        comentario?: string | null;
      }) =>
        enviar<ProyectoDetalle>(`/proyectos/${proyectoId}/etapas/${etapaId}/aprobacion-interna`, {
          resultado,
          version,
          comentario,
        }),
      onSuccess: refrescar,
    }),
    respuestaCliente: useMutation({
      mutationFn: ({
        proyectoId,
        etapaId,
        ...body
      }: {
        proyectoId: string;
        etapaId: string;
        resultado: "aprobada" | "cambios";
        version: number;
        aprobadorNombre: string;
        medio: "whatsapp" | "email" | "reunion" | "en_persona" | "link";
        aprobadoEn: string;
        comentario?: string | null;
        evidenciaUrl?: string | null;
      }) => enviar<ProyectoDetalle>(`/proyectos/${proyectoId}/etapas/${etapaId}/respuesta-cliente`, body),
      onSuccess: refrescar,
    }),
    cambiarEstado: useMutation({
      mutationFn: ({
        id,
        estado,
        motivo,
      }: {
        id: string;
        estado: EstadoProyecto;
        motivo?: string | null;
      }) => enviar<ProyectoDetalle>(`/proyectos/${id}/estado`, { estado, motivo }),
      onSuccess: refrescar,
    }),
    guardarPlantilla: useMutation({
      mutationFn: ({ id, ...body }: { id?: string } & Record<string, unknown>) =>
        enviar<PlantillaProyecto>(id ? `/plantillas-proyecto/${id}` : "/plantillas-proyecto", body, id ? "PUT" : "POST"),
      onSuccess: refrescar,
    }),
    archivarPlantilla: useMutation({
      mutationFn: (id: string) => enviar(`/plantillas-proyecto/${id}/archivar`, {}),
      onSuccess: refrescar,
    }),
  };
}

export function mensajePedidoAprobacionWeb(params: {
  cliente?: string | null;
  proyecto: string;
  etapa: string;
  version: number;
  negocio?: string | null;
}): string {
  const saludo = params.cliente?.trim() ? `Hola ${params.cliente.trim()}!` : "Hola!";
  const firma = params.negocio?.trim() ? ` — ${params.negocio.trim()}` : "";
  return `${saludo} Te paso para revisar «${params.etapa}» (v${params.version}) de ${params.proyecto}. ¿Nos confirmás si va o qué cambiarías?${firma}`;
}

export function inicialesNombre(nombre: string | null | undefined): string {
  if (!nombre) return "—";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function fechaCortaAR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}
