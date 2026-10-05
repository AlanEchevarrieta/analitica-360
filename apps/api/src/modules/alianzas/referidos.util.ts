/**
 * Referidos: cada cliente tiene su código para recomendar Analítica 360.
 * - El negocio nuevo que se registra con el código: 30 días de prueba y 10% en su primer pago.
 * - El que recomienda: cuando el nuevo hace su primer pago, gana un 10% para su próximo
 *   período. Se suman (3 amigos que pagan = 30%), con un máximo de 6 premios por año.
 */
import { MESES_CICLO, type CicloFacturacion } from '../planes/planes.util.js';
import { redondear, type Cotizacion, type ReglasCupon } from './alianzas.util.js';

export const DIAS_PRUEBA_REFERIDO = 30;
export const DESCUENTO_NUEVO_PCT = 10;
export const PREMIO_PCT = 10;
export const MAX_PREMIOS_POR_ANIO = 6;

/** Reglas del código de referido: 10% en el primer período, cualquiera sea el ciclo. */
export function reglasReferido(): ReglasCupon {
  const regla = (ciclo: CicloFacturacion) => ({
    entrada: [{ meses: MESES_CICLO[ciclo], porcentaje: DESCUENTO_NUEVO_PCT }],
    periodosEntrada: 1,
    renovacionPct: 0,
    renovacionPeriodos: 0,
    cuotas: null,
  });
  return { mensual: regla('mensual'), trimestral: regla('trimestral'), anual: regla('anual') };
}

// Sin letras que se confunden al dictarlas (0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "Acacia Mates" → "ACACIA-7K2": la primera palabra del nombre (o más, si es muy corta; hasta 10 letras) y 3 caracteres al azar. */
export function codigoReferido(nombre: string, azar: () => number = Math.random): string {
  const palabras = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  let base = '';
  for (const p of palabras) {
    if (base.length >= 4) break;
    base += p;
  }
  base = base.slice(0, 10) || 'AMIGO';
  const sufijo = Array.from({ length: 3 }, () => ALFABETO[Math.floor(azar() * ALFABETO.length)]).join('');
  return `${base}-${sufijo}`;
}

/** El premio nuevo cuenta para el tope si en los últimos 12 meses ganó menos de 6 (los anulados no cuentan). */
export function estadoPremioNuevo(premiosDelUltimoAnio: number): 'disponible' | 'tope' {
  return premiosDelUltimoAnio < MAX_PREMIOS_POR_ANIO ? 'disponible' : 'tope';
}

/** % total a descontar con los premios disponibles (se suman; nunca más de 6 × 10%). */
export function porcentajePremios(porcentajes: number[]): number {
  const usables = porcentajes.slice(0, MAX_PREMIOS_POR_ANIO);
  return Math.min(
    usables.reduce((a, p) => a + p, 0),
    MAX_PREMIOS_POR_ANIO * PREMIO_PCT,
  );
}

/**
 * Aplica los premios por recomendar sobre el precio del período (después de los
 * descuentos de su código, si tiene). Devuelve la cotización con el total nuevo.
 */
export function aplicarPremios(c: Cotizacion, pct: number): Cotizacion {
  if (!(pct > 0)) return c;
  const total = redondear(c.total * (1 - pct / 100));
  return { ...c, total, descuento: c.lista - total, montoCuota: redondear(total / c.cuotas), referidosPct: pct };
}
