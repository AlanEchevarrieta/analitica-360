/**
 * Precios de la tienda online: ofertas por producto, cupones y descuento por
 * transferencia. Puro (sin base) para poder testearlo; todo se redondea a pesos.
 *
 * Orden: precio de lista → oferta del producto (por ítem) → cupón (sobre el
 * subtotal) → % por transferencia (sobre lo que queda).
 */

export type TipoOferta = 'porcentaje' | 'precio';
export type TipoCupon = 'porcentaje' | 'monto';

export interface Oferta {
  tipo: TipoOferta;
  valor: number;
  /** AAAA-MM-DD, inclusive; null = sin límite. */
  desde: string | null;
  hasta: string | null;
}

export interface CuponTienda {
  codigo: string;
  tipo: TipoCupon;
  valor: number;
  compraMinima: number | null;
  desde: string | null;
  hasta: string | null;
  usosMax: number | null;
  usos: number;
  activo: boolean;
}

const pesos = (n: number) => Math.round(n);

/** Hoy en Argentina (AAAA-MM-DD). */
export const hoyAR = (ahora = new Date()) => new Date(ahora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

export const vigente = (desde: string | null, hasta: string | null, hoy: string) => (!desde || desde <= hoy) && (!hasta || hoy <= hasta);

/** Código como lo guarda la base: mayúsculas, sin espacios. */
export const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, '');

export interface PrecioFinal {
  precio: number;
  precioLista: number;
  /** 0 si no hay oferta vigente. */
  descuentoPct: number;
  ofertaHasta: string | null;
}

/** Precio con la oferta aplicada, si está vigente y de verdad baja el precio. */
export function precioConOferta(precioLista: number, oferta: Oferta | null, hoy: string): PrecioFinal {
  const sin: PrecioFinal = { precio: pesos(precioLista), precioLista: pesos(precioLista), descuentoPct: 0, ofertaHasta: null };
  if (!oferta || precioLista <= 0 || !vigente(oferta.desde, oferta.hasta, hoy)) return sin;
  const precio = oferta.tipo === 'porcentaje' ? pesos(precioLista * (1 - oferta.valor / 100)) : pesos(oferta.valor);
  if (precio <= 0 || precio >= precioLista) return sin;
  return { precio, precioLista: pesos(precioLista), descuentoPct: Math.round((1 - precio / precioLista) * 100), ofertaHasta: oferta.hasta };
}

export type MotivoCupon = 'no_existe' | 'inactivo' | 'todavia_no' | 'vencido' | 'agotado' | 'compra_minima';

export const MENSAJE_CUPON: Record<MotivoCupon, string> = {
  no_existe: 'Ese código no existe',
  inactivo: 'Ese código ya no está activo',
  todavia_no: 'Ese código todavía no está vigente',
  vencido: 'Ese código está vencido',
  agotado: 'Ese código ya se usó todas las veces posibles',
  compra_minima: 'La compra no llega al mínimo de ese código',
};

/** ¿Se puede usar el cupón con este subtotal? Devuelve el descuento en pesos. */
export function evaluarCupon(cupon: CuponTienda | null, subtotal: number, hoy: string): { ok: true; descuento: number } | { ok: false; motivo: MotivoCupon; minimo?: number } {
  if (!cupon) return { ok: false, motivo: 'no_existe' };
  if (!cupon.activo) return { ok: false, motivo: 'inactivo' };
  if (cupon.desde && hoy < cupon.desde) return { ok: false, motivo: 'todavia_no' };
  if (cupon.hasta && hoy > cupon.hasta) return { ok: false, motivo: 'vencido' };
  if (cupon.usosMax != null && cupon.usos >= cupon.usosMax) return { ok: false, motivo: 'agotado' };
  if (cupon.compraMinima != null && subtotal < cupon.compraMinima) return { ok: false, motivo: 'compra_minima', minimo: cupon.compraMinima };
  const descuento = cupon.tipo === 'porcentaje' ? pesos((subtotal * cupon.valor) / 100) : pesos(cupon.valor);
  // Un cupón nunca deja el pedido en negativo.
  return { ok: true, descuento: Math.min(descuento, pesos(subtotal)) };
}

export interface Totales {
  subtotal: number;
  descuentoCupon: number;
  descuentoTransferencia: number;
  total: number;
}

/** Cupón sobre el subtotal y, si paga por transferencia, el % sobre lo que queda. */
export function totalesPedido(subtotal: number, descuentoCupon: number, transferenciaPct: number, pagaPorTransferencia: boolean): Totales {
  const trasCupon = pesos(subtotal) - descuentoCupon;
  const descuentoTransferencia = pagaPorTransferencia && transferenciaPct > 0 ? pesos((trasCupon * transferenciaPct) / 100) : 0;
  return { subtotal: pesos(subtotal), descuentoCupon, descuentoTransferencia, total: trasCupon - descuentoTransferencia };
}
