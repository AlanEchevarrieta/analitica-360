/** Cuenta corriente de clientes: reglas puras. */

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface VentaPendiente {
  ventaId: string;
  /** YYYY-MM-DD */
  fecha: string;
  saldo: number;
}

/**
 * Reparte un cobro entre las ventas pendientes, de la más vieja a la más
 * nueva. Devuelve null si el cobro es mayor que lo que se debe.
 */
export function aplicarCobro(pendientes: VentaPendiente[], monto: number): { ventaId: string; monto: number }[] | null {
  const orden = [...pendientes].filter((p) => p.saldo > 0).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ventaId.localeCompare(b.ventaId));
  const deuda = r2(orden.reduce((a, p) => a + p.saldo, 0));
  if (monto <= 0 || r2(monto) > deuda) return null;
  let resto = r2(monto);
  const aplicaciones: { ventaId: string; monto: number }[] = [];
  for (const p of orden) {
    if (resto <= 0) break;
    const aplica = r2(Math.min(resto, p.saldo));
    aplicaciones.push({ ventaId: p.ventaId, monto: aplica });
    resto = r2(resto - aplica);
  }
  return aplicaciones;
}

export type Tramo = 'al_dia' | 'mas_30' | 'mas_60' | 'mas_90';

/** Antigüedad de una deuda según los días desde la venta. */
export function tramo(dias: number): Tramo {
  if (dias > 90) return 'mas_90';
  if (dias > 60) return 'mas_60';
  if (dias > 30) return 'mas_30';
  return 'al_dia';
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.max(0, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000));
}

export interface LineaCuenta {
  fecha: string;
  concepto: string;
  /** Lo que se le vendió a cuenta (aumenta la deuda). */
  debe: number;
  /** Lo que pagó (baja la deuda). */
  haber: number;
  ventaId?: string | null;
  cobroId?: string | null;
}

/** Resumen de cuenta en orden de fecha, con el saldo después de cada movimiento. */
export function estadoDeCuenta(lineas: LineaCuenta[]): (LineaCuenta & { saldo: number })[] {
  let saldo = 0;
  return [...lineas]
    // Mismo día: primero lo vendido y después lo pagado; si no, el orden en que se cargó.
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || Number(b.debe > 0) - Number(a.debe > 0))
    .map((l) => {
      saldo = r2(saldo + l.debe - l.haber);
      return { ...l, saldo };
    });
}

/** Mensaje de recordatorio por WhatsApp (amable, con el saldo). */
export function mensajeRecordatorio(nombreCliente: string, negocio: string, saldo: number): string {
  const monto = saldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const nombre = nombreCliente.split(' ')[0];
  return `Hola ${nombre}! Te escribimos de ${negocio}. Te recordamos que tenés un saldo pendiente de ${monto}. Cuando puedas, avisanos cómo preferís abonarlo. ¡Gracias!`;
}
