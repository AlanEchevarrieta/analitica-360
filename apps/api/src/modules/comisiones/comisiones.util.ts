/**
 * Comisiones (módulo de servicios, pieza 5): cuánto le toca a cada profesional.
 * Todo puro: se prueba sin base.
 */

export interface ItemComision {
  /** Servicio (corte, clase…) o producto (shampoo, repuesto…). */
  esServicio: boolean;
  /** Positivo lo vendido; negativo lo devuelto (devoluciones y cambios). */
  importe: number;
}

export interface VentaComision {
  subtotal: number;
  descuento: number;
  items: ItemComision[];
}

export interface Porcentajes {
  servicios: number;
  productos: number;
  /** $ por sesión de abono atendida (el abono se cobró aparte, no hay venta del turno). */
  porSesion: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Base de una venta separada en servicios y productos. El descuento de la venta se reparte
 * en proporción (si se descontó 10 % del total, cada ítem cuenta 10 % menos). Los intereses
 * de la tarjeta no suman: son del negocio, no del trabajo.
 */
export function baseDeVenta(v: VentaComision): { servicios: number; productos: number } {
  const factor = v.subtotal > 0 ? Math.max(0, (v.subtotal - v.descuento) / v.subtotal) : 1;
  let servicios = 0;
  let productos = 0;
  for (const i of v.items) {
    if (i.esServicio) servicios += i.importe * factor;
    else productos += i.importe * factor;
  }
  return { servicios: r2(servicios), productos: r2(productos) };
}

export function liquidar(ventas: VentaComision[], sesiones: number, p: Porcentajes) {
  const base = ventas.map(baseDeVenta).reduce((s, b) => ({ servicios: s.servicios + b.servicios, productos: s.productos + b.productos }), { servicios: 0, productos: 0 });
  const porServicios = r2((base.servicios * p.servicios) / 100);
  const porProductos = r2((base.productos * p.productos) / 100);
  const porSesiones = r2(sesiones * p.porSesion);
  return {
    baseServicios: r2(base.servicios),
    baseProductos: r2(base.productos),
    sesiones,
    porServicios,
    porProductos,
    porSesiones,
    total: r2(porServicios + porProductos + porSesiones),
  };
}
