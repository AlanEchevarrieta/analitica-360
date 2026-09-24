export interface SuscripcionActiva {
  id: string;
  estado: string;
  fechaVencimiento: string | null;
}

/** Puerto de diasRestantes (src/lib/suscripcion.ts). */
export function diasRestantes(fechaVencimiento: string | null): number {
  if (!fechaVencimiento) return 0;
  const fin = new Date(`${fechaVencimiento}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000));
}

/** Puerto de estaEnTrial. */
export function estaEnTrial(sub: SuscripcionActiva | null | undefined): boolean {
  if (!sub || sub.estado !== 'periodo_prueba') return false;
  return diasRestantes(sub.fechaVencimiento) > 0;
}

/** Puerto de trialVencido. */
export function trialVencido(sub: SuscripcionActiva | null | undefined): boolean {
  if (!sub) return false;
  if (sub.estado === 'vencida' || sub.estado === 'pendiente_pago' || sub.estado === 'cancelada') return true;
  return sub.estado === 'periodo_prueba' && diasRestantes(sub.fechaVencimiento) <= 0;
}
