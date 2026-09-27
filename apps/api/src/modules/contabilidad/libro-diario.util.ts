/**
 * Libro diario y mayor derivados de las operaciones (no se cargan a mano).
 * Plan de cuentas simple para una pyme / monotributista (sin IVA separado).
 */

export const CUENTAS = {
  caja: { nombre: 'Caja y bancos', tipo: 'activo' },
  deudores: { nombre: 'Deudores por ventas', tipo: 'activo' },
  mercaderias: { nombre: 'Mercaderías', tipo: 'activo' },
  bienesUso: { nombre: 'Bienes de uso', tipo: 'activo' },
  amortAcum: { nombre: 'Amortización acumulada', tipo: 'activo' },
  proveedores: { nombre: 'Proveedores', tipo: 'pasivo' },
  prestamos: { nombre: 'Préstamos', tipo: 'pasivo' },
  capital: { nombre: 'Capital (aportes)', tipo: 'patrimonio' },
  retiros: { nombre: 'Retiros del dueño', tipo: 'patrimonio' },
  ventas: { nombre: 'Ventas', tipo: 'resultado' },
  devoluciones: { nombre: 'Devoluciones sobre ventas', tipo: 'resultado' },
  cmv: { nombre: 'Costo de mercadería vendida', tipo: 'resultado' },
  perdidas: { nombre: 'Pérdidas de mercadería', tipo: 'resultado' },
  amortizaciones: { nombre: 'Amortizaciones', tipo: 'resultado' },
} as const;

export type CuentaFija = keyof typeof CUENTAS;
/** Las de gastos se arman por categoría: `gastos:alquiler`. */
export type Cuenta = CuentaFija | `gastos:${string}`;

export interface Linea {
  cuenta: Cuenta;
  debe: number;
  haber: number;
}

export interface Asiento {
  fecha: string;
  concepto: string;
  /** Qué operación lo generó (para ordenar y agrupar). */
  origen: 'venta' | 'cobro' | 'devolucion' | 'compra' | 'pago_proveedor' | 'gasto' | 'movimiento' | 'perdida' | 'amortizacion';
  lineas: Linea[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const d = (cuenta: Cuenta, monto: number): Linea => ({ cuenta, debe: r2(monto), haber: 0 });
const h = (cuenta: Cuenta, monto: number): Linea => ({ cuenta, debe: 0, haber: r2(monto) });
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

export interface VentasDia {
  fecha: string;
  cantidad: number;
  total: number;
  /** Cobrado al vender (contado + señas). El resto queda en deudores. */
  cobrado: number;
  costo: number;
}
export interface CobroDato {
  fecha: string;
  monto: number;
  detalle: string;
}
export interface DevolucionesDia {
  fecha: string;
  /** Negativo: se devolvió plata; positivo: el cliente pagó diferencia. */
  ingreso: number;
  /** Costo de la mercadería que volvió (negativo) o salió (positivo). */
  costo: number;
}
export interface CompraAsiento {
  fecha: string;
  monto: number;
  aCredito: boolean;
  proveedor: string;
}
export interface GastoAsiento {
  fecha: string;
  monto: number;
  categoria: string;
  descripcion: string | null;
}
export interface MovimientoAsiento {
  fecha: string;
  tipo: string;
  monto: number;
  conCaja: boolean;
  descripcion: string | null;
}

export interface DatosDiario {
  ventas: VentasDia[];
  cobros: CobroDato[];
  devoluciones: DevolucionesDia[];
  compras: CompraAsiento[];
  gastos: GastoAsiento[];
  movimientos: MovimientoAsiento[];
  perdidas: { fecha: string; monto: number }[];
  /** Amortización de cada mes (se asienta el último día del mes o el último del período). */
  amortizaciones: { fecha: string; monto: number }[];
}

/** Arma los asientos del período (ya filtrados por fecha), en orden. */
export function asientos(datos: DatosDiario): Asiento[] {
  const out: Asiento[] = [];
  for (const v of datos.ventas) {
    if (v.total === 0 && v.costo === 0) continue;
    const lineas = [d('caja', v.cobrado)];
    if (r2(v.total - v.cobrado) !== 0) lineas.push(d('deudores', v.total - v.cobrado));
    lineas.push(h('ventas', v.total));
    if (v.costo > 0) lineas.push(d('cmv', v.costo), h('mercaderias', v.costo));
    out.push({ fecha: v.fecha, origen: 'venta', concepto: `Ventas del ${fechaCorta(v.fecha)} (${v.cantidad} ${v.cantidad === 1 ? 'venta' : 'ventas'})`, lineas: lineas.filter((l) => l.debe || l.haber) });
  }
  for (const c of datos.cobros) {
    if (c.monto <= 0) continue;
    out.push({ fecha: c.fecha, origen: 'cobro', concepto: `Cobro de saldo · ${c.detalle}`, lineas: [d('caja', c.monto), h('deudores', c.monto)] });
  }
  for (const x of datos.devoluciones) {
    const lineas: Linea[] = [];
    if (x.ingreso < 0) lineas.push(d('devoluciones', -x.ingreso), h('caja', -x.ingreso));
    if (x.ingreso > 0) lineas.push(d('caja', x.ingreso), h('devoluciones', x.ingreso));
    if (x.costo < 0) lineas.push(d('mercaderias', -x.costo), h('cmv', -x.costo));
    if (x.costo > 0) lineas.push(d('cmv', x.costo), h('mercaderias', x.costo));
    if (lineas.length) out.push({ fecha: x.fecha, origen: 'devolucion', concepto: `Devoluciones y cambios del ${fechaCorta(x.fecha)}`, lineas });
  }
  for (const c of datos.compras) {
    if (c.monto <= 0) continue;
    out.push({ fecha: c.fecha, origen: 'compra', concepto: `Compra a ${c.proveedor}${c.aCredito ? ' (a crédito)' : ''}`, lineas: [d('mercaderias', c.monto), h(c.aCredito ? 'proveedores' : 'caja', c.monto)] });
  }
  for (const g of datos.gastos) {
    if (g.monto <= 0) continue;
    out.push({ fecha: g.fecha, origen: 'gasto', concepto: `Gasto: ${g.descripcion || g.categoria}`, lineas: [d(`gastos:${g.categoria}`, g.monto), h('caja', g.monto)] });
  }
  for (const m of datos.movimientos) {
    const txt = m.descripcion ? ` · ${m.descripcion}` : '';
    const par = (debe: Cuenta, haber: Cuenta, concepto: string) => out.push({ fecha: m.fecha, origen: m.tipo === 'pago_proveedor' ? 'pago_proveedor' : 'movimiento', concepto: concepto + txt, lineas: [d(debe, m.monto), h(haber, m.monto)] });
    if (m.monto <= 0) continue;
    if (m.tipo === 'aporte') par('caja', 'capital', 'Aporte de los dueños');
    else if (m.tipo === 'retiro') par('retiros', 'caja', 'Retiro de los dueños');
    else if (m.tipo === 'prestamo_recibido') par('caja', 'prestamos', 'Préstamo recibido');
    else if (m.tipo === 'prestamo_pago') par('prestamos', 'caja', 'Pago de préstamo');
    else if (m.tipo === 'pago_proveedor') par('proveedores', 'caja', 'Pago a proveedor');
    else if (m.tipo === 'bien_uso') par('bienesUso', m.conCaja ? 'caja' : 'capital', m.conCaja ? 'Compra de bien de uso' : 'Bien de uso aportado por los dueños');
  }
  for (const p of datos.perdidas) {
    if (p.monto <= 0) continue;
    out.push({ fecha: p.fecha, origen: 'perdida', concepto: `Mermas y roturas del ${fechaCorta(p.fecha)}`, lineas: [d('perdidas', p.monto), h('mercaderias', p.monto)] });
  }
  for (const a of datos.amortizaciones) {
    if (a.monto <= 0) continue;
    out.push({ fecha: a.fecha, origen: 'amortizacion', concepto: `Amortización de bienes de uso (${a.fecha.slice(5, 7)}/${a.fecha.slice(0, 4)})`, lineas: [d('amortizaciones', a.monto), h('amortAcum', a.monto)] });
  }
  const ordenOrigen = ['movimiento', 'compra', 'venta', 'cobro', 'devolucion', 'pago_proveedor', 'gasto', 'perdida', 'amortizacion'];
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenOrigen.indexOf(a.origen) - ordenOrigen.indexOf(b.origen));
}

export function nombreCuenta(c: Cuenta, categorias: Record<string, string> = {}): string {
  if (c.startsWith('gastos:')) {
    const cat = c.slice(7);
    return `Gastos de ${(categorias[cat] ?? cat).toLowerCase()}`;
  }
  return CUENTAS[c as CuentaFija].nombre;
}

export function tipoCuenta(c: Cuenta): 'activo' | 'pasivo' | 'patrimonio' | 'resultado' {
  return c.startsWith('gastos:') ? 'resultado' : CUENTAS[c as CuentaFija].tipo;
}

/** Libro mayor del período: por cuenta, lo que entró al debe, al haber y el saldo (debe - haber). */
export function mayor(lista: Asiento[]) {
  const porCuenta = new Map<Cuenta, { debe: number; haber: number; movimientos: number }>();
  for (const a of lista) {
    for (const l of a.lineas) {
      const c = porCuenta.get(l.cuenta) ?? { debe: 0, haber: 0, movimientos: 0 };
      c.debe += l.debe;
      c.haber += l.haber;
      c.movimientos += 1;
      porCuenta.set(l.cuenta, c);
    }
  }
  const orden = ['activo', 'pasivo', 'patrimonio', 'resultado'];
  return [...porCuenta]
    .map(([cuenta, c]) => ({ cuenta, tipo: tipoCuenta(cuenta), debe: r2(c.debe), haber: r2(c.haber), saldo: r2(c.debe - c.haber), movimientos: c.movimientos }))
    .sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo) || a.cuenta.localeCompare(b.cuenta));
}
