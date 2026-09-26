import type { AdminEmpresaFila, AlertaEmpresa } from './admin-clientes.types.js';

/** Días sin vender a partir de los cuales un cliente se considera inactivo. */
export const DIAS_SIN_ACTIVIDAD = 14;

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}

/** Señales para actuar a tiempo sobre un cliente (dado de baja = sin alertas). */
export function alertasEmpresa(e: AdminEmpresaFila, hoy: string): { alertas: AlertaEmpresa[]; diasSinVender: number | null } {
  const diasSinVender = e.ultimaVenta ? diasEntre(e.ultimaVenta, hoy) : null;
  if (e.baja) return { alertas: [], diasSinVender };
  const alertas: AlertaEmpresa[] = [];
  const diasParaVencer = e.vencimiento ? diasEntre(hoy, e.vencimiento) : null;

  if (!e.suscripcionId) alertas.push('sin_suscripcion');
  else if (['vencida', 'pendiente_pago', 'cancelada'].includes(e.estado ?? '') || (diasParaVencer != null && diasParaVencer < 0)) alertas.push('vencida');
  else if (e.estado === 'periodo_prueba' && diasParaVencer != null && diasParaVencer <= 3) alertas.push('prueba_termina');
  else if (e.estado === 'activa' && diasParaVencer != null && diasParaVencer <= 7) alertas.push('vence_pronto');

  // Recién registrado: todavía está cargando productos, no es "inactivo".
  const reciente = diasEntre(e.alta, hoy) < 7;
  if (!reciente && (diasSinVender == null || diasSinVender > DIAS_SIN_ACTIVIDAD)) alertas.push('sin_actividad');
  else if (e.montoPrevio30 > 0 && e.monto30 < e.montoPrevio30 * 0.5) alertas.push('ventas_bajan');

  return { alertas, diasSinVender };
}
