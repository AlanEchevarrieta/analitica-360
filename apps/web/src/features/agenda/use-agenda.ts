"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/agenda.
export type EstadoTurno = "reservado" | "confirmado" | "atendido" | "no_vino" | "cancelado";

export const NOMBRE_ESTADO_TURNO: Record<EstadoTurno, string> = { reservado: "Reservado", confirmado: "Confirmado", atendido: "Atendido", no_vino: "No vino", cancelado: "Cancelado" };
/** Los que ocupan el horario; "no vino" y "cancelado" lo liberan. */
export const OCUPAN: EstadoTurno[] = ["reservado", "confirmado", "atendido"];
export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export interface Horario {
  diaSemana: number;
  desde: string;
  hasta: string;
}

export interface Recurso {
  id: string;
  nombre: string;
  usuarioId: string | null;
  color: string;
  online: boolean;
  activo: boolean;
  horarios: Horario[];
}

export interface Turno {
  id: string;
  recursoId: string;
  recurso: string;
  color: string;
  servicioId: string | null;
  servicio: string | null;
  precio: number | null;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  /** "2026-10-15T15:30", hora de Argentina. */
  inicio: string;
  fin: string;
  duracionMin: number;
  estado: EstadoTurno;
  notas: string | null;
  origen: "interno" | "online";
  ventaId: string | null;
  recordadoEn: string | null;
}

export interface Bloqueo {
  id: string;
  recursoId: string | null;
  fecha: string;
  motivo: string | null;
}

export interface TurnoInput {
  recursoId: string;
  servicioId: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  inicio: string;
  duracionMin: number | null;
  notas: string | null;
  forzar?: boolean;
}

export interface RecursoInput {
  nombre: string;
  usuarioId: string | null;
  color: string;
  online: boolean;
  activo: boolean;
  horarios: Horario[];
}

function useConsulta<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["agenda", ...clave, orgId], queryFn: () => api<T>(ruta!), enabled: Boolean(orgId && ruta) });
}

export const useRecursos = () => useConsulta<Recurso[]>(["recursos"], "/agenda/recursos");
export const useTurnos = (desde: string, hasta: string) => useConsulta<Turno[]>(["turnos", desde, hasta], `/agenda/turnos?desde=${desde}&hasta=${hasta}`);
export const useTurno = (id: string | null, fecha: string | null) => {
  const turnos = useConsulta<Turno[]>(["turnos", fecha, fecha], id && fecha ? `/agenda/turnos?desde=${fecha}&hasta=${fecha}` : null);
  return { ...turnos, data: turnos.data?.find((t) => t.id === id) ?? null };
};
export const useBloqueos = (desde: string, hasta: string) => useConsulta<Bloqueo[]>(["bloqueos", desde, hasta], `/agenda/bloqueos?desde=${desde}&hasta=${hasta}`);
export const useLibres = (recursoId: string | null, fecha: string, servicioId: string | null, duracionMin: number | null) =>
  useConsulta<{ fecha: string; duracionMin: number; libres: string[] }>(
    ["libres", recursoId, fecha, servicioId, duracionMin],
    recursoId && fecha ? `/agenda/libres?${new URLSearchParams({ recursoId, fecha, ...(servicioId ? { servicioId } : {}), ...(duracionMin ? { duracionMin: String(duracionMin) } : {}) })}` : null,
  );

function useOp<A, T>(fn: (a: A) => Promise<T>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agenda"] }) });
}

export function useAccionesAgenda() {
  const api = useApiFetch();
  const enviar = <T,>(ruta: string, body?: unknown, method = "POST") => api<T>(ruta, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

  return {
    crearTurno: useOp((d: TurnoInput) => enviar<Turno>("/agenda/turnos", d)),
    reprogramar: useOp(({ id, ...d }: Partial<TurnoInput> & { id: string }) => enviar<Turno>(`/agenda/turnos/${id}`, d, "PATCH")),
    estado: useOp(({ id, estado }: { id: string; estado: EstadoTurno }) => enviar<Turno>(`/agenda/turnos/${id}/estado`, { estado })),
    cobrado: useOp(({ id, ventaId }: { id: string; ventaId: string }) => enviar<Turno>(`/agenda/turnos/${id}/cobrado`, { ventaId })),
    recordatorio: useOp((id: string) => enviar<{ mensaje: string; telefono: string | null; whatsapp: string }>(`/agenda/turnos/${id}/recordatorio`)),
    crearRecurso: useOp((d: RecursoInput) => enviar<Recurso>("/agenda/recursos", d)),
    editarRecurso: useOp(({ id, ...d }: RecursoInput & { id: string }) => enviar<Recurso>(`/agenda/recursos/${id}`, d, "PUT")),
    borrarRecurso: useOp((id: string) => enviar(`/agenda/recursos/${id}`, undefined, "DELETE")),
    crearBloqueo: useOp((d: { fecha: string; recursoId: string | null; motivo: string | null }) => enviar<{ id: string }>("/agenda/bloqueos", d)),
    borrarBloqueo: useOp((id: string) => enviar(`/agenda/bloqueos/${id}`, undefined, "DELETE")),
  };
}

export const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** "Jueves 15/10" */
export function fechaLarga(fecha: string) {
  return `${DIAS_SEMANA[diaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}
