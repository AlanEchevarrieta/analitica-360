import { cabecerasTienda, urlTienda } from "./api";

// Espejo de la API (apps/api modules/agenda/agenda-online.service.ts).
export type ServicioTurno = { id: string; nombre: string; duracionMin: number; precio: number | null; modoPrecio: string };
export type ProfesionalTurno = { id: string; nombre: string; color: string };
export type OpcionesTurnos =
  | { activa: false }
  | { activa: true; diasMaximo: number; mensaje: string | null; hoy: string; servicios: ServicioTurno[]; profesionales: ProfesionalTurno[] };
export type HorarioLibre = { hora: string; profesionales: string[] };
export type TurnoReservado = { id: string; servicio: string; profesional: string; inicio: string; fin: string; cuando: string; mensaje: string | null };

/** Servicios y profesionales que el negocio ofrece para reservar (solo desde el servidor). */
export async function opcionesTurnos(empresaId: string): Promise<OpcionesTurnos> {
  try {
    const res = await fetch(urlTienda(empresaId, "/turnos"), { headers: await cabecerasTienda(), cache: "no-store" });
    return res.ok ? ((await res.json()) as OpcionesTurnos) : { activa: false };
  } catch {
    return { activa: false };
  }
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Los próximos `n` días desde `hoy` (AAAA-MM-DD), con su etiqueta corta. */
export function proximosDias(hoy: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.parse(`${hoy}T12:00:00Z`) + i * 86_400_000);
    return { fecha: d.toISOString().slice(0, 10), dia: i === 0 ? "Hoy" : i === 1 ? "Mañana" : DIAS[d.getUTCDay()], numero: `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` };
  });
}
