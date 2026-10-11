import type { MonedaPresupuesto } from '../cotizaciones/cotizaciones.service.js';

export const SIMBOLO_MONEDA: Record<MonedaPresupuesto, string> = { ARS: '$', USD: 'US$', BRL: 'R$', CLP: 'CLP$' };
export const NOMBRE_MONEDA: Record<MonedaPresupuesto, string> = { ARS: 'pesos', USD: 'dólares', BRL: 'reales', CLP: 'pesos chilenos' };
/** El peso chileno no usa centavos. */
export const DECIMALES_MONEDA: Record<MonedaPresupuesto, number> = { ARS: 2, USD: 2, BRL: 2, CLP: 0 };

/** Pesos → moneda del presupuesto, redondeado a sus decimales. */
export function convertir(pesos: number, cotizacion: number, moneda: MonedaPresupuesto): number {
  const f = 10 ** DECIMALES_MONEDA[moneda];
  return Math.round((pesos / cotizacion) * f) / f;
}

/**
 * Los montos del presupuesto en su moneda. Se convierte cada precio y el
 * descuento, y el total sale de esos números (así las cuentas del PDF cierran).
 */
export function montosEnMoneda(items: { cantidad: number; precioUnitario: number }[], descuento: number, moneda: MonedaPresupuesto, cotizacion: number | null) {
  if (moneda === 'ARS' || !cotizacion) {
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
    return { precios: items.map((i) => i.precioUnitario), subtotal, descuento, total: Math.max(0, subtotal - descuento) };
  }
  const f = 10 ** DECIMALES_MONEDA[moneda];
  const redondear = (n: number) => Math.round(n * f) / f;
  const precios = items.map((i) => convertir(i.precioUnitario, cotizacion, moneda));
  const subtotal = redondear(items.reduce((s, i, n) => s + i.cantidad * precios[n], 0));
  const desc = convertir(descuento, cotizacion, moneda);
  return { precios, subtotal, descuento: desc, total: Math.max(0, redondear(subtotal - desc)) };
}
