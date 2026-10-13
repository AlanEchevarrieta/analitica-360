"use server";

import { cabecerasTienda, mensajeDeError, urlTienda } from "@/lib/api";
import { tokenSesion } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";
import type { HorarioLibre, TurnoACancelar, TurnoReservado } from "@/lib/turnos";

/** Horarios libres de un día para un servicio (de un profesional o de cualquiera). */
export async function horariosLibres(fecha: string, servicioId: string, recursoId: string | null): Promise<{ ok: true; libres: HorarioLibre[] } | { ok: false; error: string }> {
  const sitio = await obtenerSitio();
  if (!sitio) return { ok: false, error: "Esta tienda no está disponible" };
  const params = new URLSearchParams({ fecha, servicioId, ...(recursoId ? { recursoId } : {}) });
  try {
    const res = await fetch(urlTienda(sitio.empresaId, `/turnos/libres?${params}`), { headers: await cabecerasTienda(), cache: "no-store" });
    if (res.status === 429) return { ok: false, error: "Esperá un momento y volvé a intentar." };
    if (!res.ok) return { ok: false, error: await mensajeDeError(res, "No pudimos traer los horarios") };
    return { ok: true, libres: ((await res.json()) as { libres: HorarioLibre[] }).libres };
  } catch {
    return { ok: false, error: "No pudimos traer los horarios. Probá de nuevo." };
  }
}

export async function reservarTurno(datos: { servicioId: string; recursoId: string | null; fecha: string; hora: string; nombre: string; telefono: string; notas: string }): Promise<{ ok: true; turno: TurnoReservado } | { ok: false; error: string; ocupado?: boolean }> {
  const sitio = await obtenerSitio();
  if (!sitio) return { ok: false, error: "Esta tienda no está disponible" };
  const sesion = await tokenSesion();
  try {
    const res = await fetch(urlTienda(sitio.empresaId, "/turnos"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecerasTienda()), ...(sesion ? { "x-sesion-tienda": sesion } : {}) },
      body: JSON.stringify({
        servicioId: datos.servicioId,
        recursoId: datos.recursoId,
        fecha: datos.fecha,
        hora: datos.hora,
        nombre: datos.nombre.trim().slice(0, 120),
        telefono: datos.telefono.trim().slice(0, 40),
        notas: datos.notas.trim().slice(0, 500) || null,
      }),
      cache: "no-store",
    });
    if (res.status === 429) return { ok: false, error: "Hiciste varias reservas seguidas. Esperá un minuto y volvé a intentar." };
    if (!res.ok) return { ok: false, error: await mensajeDeError(res, "No pudimos reservar el turno"), ocupado: res.status === 409 };
    return { ok: true, turno: (await res.json()) as TurnoReservado };
  } catch {
    return { ok: false, error: "No pudimos reservar el turno. Probá de nuevo." };
  }
}

/** El cliente cancela su turno con el link que le quedó al reservar. */
export async function cancelarTurno(token: string): Promise<{ ok: true; turno: TurnoACancelar } | { ok: false; error: string }> {
  const sitio = await obtenerSitio();
  if (!sitio) return { ok: false, error: "Esta tienda no está disponible" };
  try {
    const res = await fetch(urlTienda(sitio.empresaId, `/turnos/cancelar/${encodeURIComponent(token.slice(0, 200))}`), { method: "POST", headers: await cabecerasTienda(), cache: "no-store" });
    if (res.status === 429) return { ok: false, error: "Esperá un minuto y volvé a intentar." };
    if (!res.ok) return { ok: false, error: await mensajeDeError(res, "No pudimos cancelar el turno") };
    return { ok: true, turno: (await res.json()) as TurnoACancelar };
  } catch {
    return { ok: false, error: "No pudimos cancelar el turno. Probá de nuevo." };
  }
}
