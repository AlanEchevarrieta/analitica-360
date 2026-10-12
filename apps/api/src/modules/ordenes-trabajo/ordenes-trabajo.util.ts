/** Órdenes de trabajo: etapas y cómo se arma la venta al entregar (con la seña). */

export const ESTADOS_OT = ['recibido', 'en_proceso', 'listo', 'entregado', 'cancelada'] as const;
export type EstadoOt = (typeof ESTADOS_OT)[number];
/** Las que se cambian a mano (entregar y cancelar tienen su propio paso). */
export const ESTADOS_MANUALES = ['recibido', 'en_proceso', 'listo'] as const;
export type EstadoManual = (typeof ESTADOS_MANUALES)[number];

export const NOMBRE_ESTADO_OT: Record<EstadoOt, string> = {
  recibido: 'Recibido',
  en_proceso: 'En proceso',
  listo: 'Listo para retirar',
  entregado: 'Entregado',
  cancelada: 'Cancelada',
};

export const abierta = (estado: string) => estado !== 'entregado' && estado !== 'cancelada';

/**
 * Qué venta armar al entregar. La venta es por el total; lo que el cliente paga
 * ahora entra como seña de la venta (o todo a cuenta corriente), y el saldo que
 * queda es justo la seña que ya dejó, que después se le aplica con su fecha.
 */
export function ventaDeEntrega(total: number, senia: number, formaPago: string):
  | { ok: true; formaPago: string; esSenia: boolean; montoSenia: number; aplicarSenia: number }
  | { ok: false; motivo: string } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (senia < 0) return { ok: false, motivo: 'La seña no puede ser negativa' };
  if (senia === 0) return { ok: true, formaPago, esSenia: false, montoSenia: 0, aplicarSenia: 0 };
  if (senia - total > 0.009) return { ok: false, motivo: `La seña ($${senia.toLocaleString('es-AR')}) supera el total ($${total.toLocaleString('es-AR')}): sumá ítems o devolvé la diferencia` };
  // Queda debiendo lo que falta (o la seña cubre todo): la venta va a cuenta corriente y la seña se aplica.
  if (formaPago === 'cuenta_corriente' || Math.abs(total - senia) <= 0.009) return { ok: true, formaPago: 'cuenta_corriente', esSenia: false, montoSenia: 0, aplicarSenia: senia };
  return { ok: true, formaPago, esSenia: true, montoSenia: r2(total - senia), aplicarSenia: senia };
}

/** Mensaje de WhatsApp para avisarle al cliente en qué etapa está. */
export function mensajeEtapa(d: { estado: EstadoOt; numero: string; equipo: string; cliente: string | null; negocio: string; total: number | null }): string {
  const saludo = `Hola${d.cliente ? ` ${d.cliente.split(' ')[0]}` : ''}!`;
  const que = `tu ${d.equipo} (orden ${d.numero})`;
  const texto: Record<EstadoOt, string> = {
    recibido: `Recibimos ${que}. Te avisamos cuando esté listo.`,
    en_proceso: `Ya estamos trabajando en ${que}.`,
    listo: `${que.charAt(0).toUpperCase()}${que.slice(1)} ya está listo para retirar${d.total ? `. Total: $${d.total.toLocaleString('es-AR')}` : ''}.`,
    entregado: `Gracias por retirar ${que}.`,
    cancelada: `Cancelamos la orden ${d.numero} de ${d.equipo}.`,
  };
  return `${saludo} ${texto[d.estado]}\n${d.negocio}`;
}
