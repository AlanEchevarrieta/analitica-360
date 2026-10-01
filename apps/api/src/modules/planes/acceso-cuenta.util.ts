import type { SuscripcionActiva } from './suscripcion.util.js';

/** Días que un plan PAGO sigue funcionando completo después de vencer, con aviso. */
export const DIAS_GRACIA = 7;

/**
 * Qué puede hacer la empresa según su suscripción:
 * - activo: todo.
 * - gracia: todo, con aviso (plan pago vencido hace DIAS_GRACIA días o menos).
 * - solo_lectura: puede ver, no cargar nada; contratar desde Planes y pedir ayuda en Soporte.
 *   Con la prueba gratis vencida tampoco puede exportar sus datos.
 */
export type NivelAcceso = 'activo' | 'gracia' | 'solo_lectura';
export type MotivoBloqueo = 'prueba_vencida' | 'plan_vencido';

export interface AccesoCuenta {
  nivel: NivelAcceso;
  motivo: MotivoBloqueo | null;
  puedeExportar: boolean;
  /** Fecha (AAAA-MM-DD) en que pasa a solo lectura; solo en gracia. */
  bloqueoDesde: string | null;
}

const ACTIVO: AccesoCuenta = { nivel: 'activo', motivo: null, puedeExportar: true, bloqueoDesde: null };

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * `hoy` en AAAA-MM-DD (día de Argentina). El vencimiento es el último día
 * incluido: con fecha 2026-11-01 el plan funciona completo ese día.
 */
export function accesoCuenta(sub: SuscripcionActiva | null, esDemo: boolean, hoy: string): AccesoCuenta {
  // Sin suscripción la empresa recibe una prueba al pedir su estado (activa() la crea).
  if (esDemo || !sub) return ACTIVO;

  if (sub.estado === 'periodo_prueba') {
    if (sub.fechaVencimiento && hoy < sub.fechaVencimiento) return ACTIVO;
    return { nivel: 'solo_lectura', motivo: 'prueba_vencida', puedeExportar: false, bloqueoDesde: null };
  }

  if (sub.estado === 'activa') {
    if (!sub.fechaVencimiento || hoy <= sub.fechaVencimiento) return ACTIVO;
    const bloqueoDesde = sumarDias(sub.fechaVencimiento, DIAS_GRACIA + 1);
    if (hoy < bloqueoDesde) return { nivel: 'gracia', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde };
    return { nivel: 'solo_lectura', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde: null };
  }

  // vencida | cancelada | pendiente_pago: los marca el admin; ya pagó alguna vez, puede llevarse sus datos.
  return { nivel: 'solo_lectura', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde: null };
}
