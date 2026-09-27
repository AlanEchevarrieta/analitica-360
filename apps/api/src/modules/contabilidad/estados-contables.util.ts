/**
 * Estados contables básicos (Balance, Resultados, Evolución del Patrimonio
 * Neto y Flujo de Efectivo) armados a partir de lo que ya registra el
 * sistema: ventas, devoluciones, compras, gastos, stock y los movimientos
 * financieros (aportes, retiros, préstamos, bienes de uso, pagos a
 * proveedores y arqueos de caja).
 *
 * Todo son funciones puras sobre fechas ISO (YYYY-MM-DD, día local AR) para
 * poder probarlas sin base de datos.
 */

export type TipoMovimientoFinanciero =
  | 'arqueo'
  | 'aporte'
  | 'retiro'
  | 'prestamo_recibido'
  | 'prestamo_pago'
  | 'bien_uso'
  | 'pago_proveedor';

export const TIPOS_MOVIMIENTO_FINANCIERO: TipoMovimientoFinanciero[] = [
  'arqueo',
  'aporte',
  'retiro',
  'prestamo_recibido',
  'prestamo_pago',
  'bien_uso',
  'pago_proveedor',
];

export interface MovimientoFinancieroDato {
  tipo: TipoMovimientoFinanciero;
  monto: number;
  fecha: string;
  /** bien_uso: meses de vida útil (null = no se amortiza, ej. un terreno). */
  vidaUtilMeses: number | null;
  /** bien_uso: false = aporte en especie, no sale plata de la caja. */
  conCaja: boolean;
  /** Para ordenar arqueos del mismo día (el último cargado manda). */
  creado: string;
}

export interface MontoDia {
  fecha: string;
  monto: number;
}

/** Resultado devengado de un día: ventas (o ajuste de devoluciones) y su costo. */
export interface ResultadoDia {
  fecha: string;
  ingreso: number;
  cogs: number;
  /** true = devoluciones/cambios del día (no es una venta). */
  esAjuste: boolean;
  /** Cantidad de ventas del día (se usa para contar ventas del período). */
  ventas?: number;
}

export interface GastoDato {
  fecha: string;
  monto: number;
  categoria: string;
}

export interface SeniaDato {
  fecha: string;
  total: number;
  montoSenia: number;
  saldoPendiente: number;
  /** Día en que se terminó de cobrar el saldo (null = sin cobrar del todo). */
  fechaCobroSaldo: string | null;
  /** Pagos registrados uno por uno (cuenta corriente), con su día. */
  cobros?: { fecha: string; monto: number }[];
}

export interface CompraDato {
  fecha: string;
  monto: number;
  aCredito: boolean;
}

/** Todo lo necesario, desde el primer registro hasta la fecha de cierre. */
export interface DatosContables {
  /** Plata cobrada por ventas, por día (seña al vender, saldo al cobrarlo). */
  cobros: MontoDia[];
  resultados: ResultadoDia[];
  gastos: GastoDato[];
  compras: CompraDato[];
  senias: SeniaDato[];
  movimientos: MovimientoFinancieroDato[];
  /** Mermas, roturas, pérdidas y consumo interno valuados a costo, por día. */
  perdidas: MontoDia[];
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

const suma = <T>(lista: T[], valor: (x: T) => number) => lista.reduce((acc, x) => acc + valor(x), 0);
const hasta = <T extends { fecha: string }>(lista: T[], fecha: string) => lista.filter((x) => x.fecha <= fecha);
const entre = <T extends { fecha: string }>(lista: T[], desde: string, hastaIncl: string) =>
  lista.filter((x) => x.fecha >= desde && x.fecha <= hastaIncl);
const redondear = (n: number) => Math.round(n * 100) / 100;

/** Meses completos entre dos fechas (lo que va de un día al mismo día del mes siguiente es 1). */
export function mesesCompletos(desde: string, al: string): number {
  if (al < desde) return 0;
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = al.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/** Amortización lineal acumulada de los bienes de uso al cierre de `fecha`. */
export function amortizacionAcumulada(movimientos: MovimientoFinancieroDato[], fecha: string): number {
  return suma(
    movimientos.filter((m) => m.tipo === 'bien_uso' && m.fecha <= fecha && m.vidaUtilMeses && m.vidaUtilMeses > 0),
    (m) => (m.monto * Math.min(mesesCompletos(m.fecha, fecha), m.vidaUtilMeses!)) / m.vidaUtilMeses!,
  );
}

export type Actividad = 'operativa' | 'inversion' | 'financiacion';

export type ConceptoCaja =
  | 'cobros_ventas'
  | 'devoluciones'
  | 'pagos_compras'
  | 'pagos_proveedores'
  | 'gastos'
  | 'bienes_uso'
  | 'aportes'
  | 'retiros'
  | 'prestamos_recibidos'
  | 'prestamos_pagados';

export const ACTIVIDAD_DE: Record<ConceptoCaja, Actividad> = {
  cobros_ventas: 'operativa',
  devoluciones: 'operativa',
  pagos_compras: 'operativa',
  pagos_proveedores: 'operativa',
  gastos: 'operativa',
  bienes_uso: 'inversion',
  aportes: 'financiacion',
  retiros: 'financiacion',
  prestamos_recibidos: 'financiacion',
  prestamos_pagados: 'financiacion',
};

interface MovimientoCaja {
  fecha: string;
  concepto: ConceptoCaja;
  /** + entra plata, - sale plata. */
  monto: number;
}

/** Cada entrada y salida de plata que conoce el sistema (los arqueos no: son una foto del saldo). */
export function movimientosDeCaja(d: DatosContables): MovimientoCaja[] {
  const out: MovimientoCaja[] = [];
  for (const c of d.cobros) out.push({ fecha: c.fecha, concepto: 'cobros_ventas', monto: c.monto });
  // Las devoluciones reintegran plata (o la cobran, si en un cambio el cliente pagó diferencia).
  for (const r of d.resultados) if (r.esAjuste && r.ingreso !== 0) out.push({ fecha: r.fecha, concepto: 'devoluciones', monto: r.ingreso });
  for (const c of d.compras) if (!c.aCredito) out.push({ fecha: c.fecha, concepto: 'pagos_compras', monto: -c.monto });
  for (const g of d.gastos) out.push({ fecha: g.fecha, concepto: 'gastos', monto: -g.monto });
  for (const m of d.movimientos) {
    const salida = { fecha: m.fecha, monto: -m.monto };
    const entrada = { fecha: m.fecha, monto: m.monto };
    if (m.tipo === 'aporte') out.push({ ...entrada, concepto: 'aportes' });
    else if (m.tipo === 'retiro') out.push({ ...salida, concepto: 'retiros' });
    else if (m.tipo === 'prestamo_recibido') out.push({ ...entrada, concepto: 'prestamos_recibidos' });
    else if (m.tipo === 'prestamo_pago') out.push({ ...salida, concepto: 'prestamos_pagados' });
    else if (m.tipo === 'pago_proveedor') out.push({ ...salida, concepto: 'pagos_proveedores' });
    else if (m.tipo === 'bien_uso' && m.conCaja) out.push({ ...salida, concepto: 'bienes_uso' });
  }
  return out;
}

/** El arqueo más reciente hasta `fecha` inclusive (saldo contado al cierre de ese día). */
function ultimoArqueo(movimientos: MovimientoFinancieroDato[], fecha: string) {
  return movimientos
    .filter((m) => m.tipo === 'arqueo' && m.fecha <= fecha)
    .sort((a, b) => (a.fecha === b.fecha ? a.creado.localeCompare(b.creado) : a.fecha.localeCompare(b.fecha)))
    .at(-1);
}

/**
 * Plata disponible (caja y bancos) al cierre de `fecha`: el último arqueo más
 * lo que entró y salió después. Sin arqueo, se arranca de 0 desde el primer
 * registro (estimada: se avisa en las notas).
 */
export function cajaAl(d: DatosContables, fecha: string, caja = movimientosDeCaja(d)): { saldo: number; estimada: boolean } {
  const arqueo = ultimoArqueo(d.movimientos, fecha);
  const flujos = caja.filter((m) => m.fecha <= fecha && (!arqueo || m.fecha > arqueo.fecha));
  return { saldo: (arqueo?.monto ?? 0) + suma(flujos, (m) => m.monto), estimada: !arqueo };
}

/** Lo que los clientes deben de ventas señadas, al cierre de `fecha`. */
export function creditosPorVentasAl(senias: SeniaDato[], fecha: string): number {
  return suma(hasta(senias, fecha), (s) => {
    const saldoOriginal = s.total - s.montoSenia;
    const cobros = s.cobros ?? [];
    // Pagos registrados: cada uno cuenta desde su día.
    const registradoHasta = suma(cobros.filter((c) => c.fecha <= fecha), (c) => c.monto);
    // Lo cobrado sin detalle (sistema anterior) cuenta el día en que se terminó de cobrar.
    const sinDetalle = saldoOriginal - s.saldoPendiente - suma(cobros, (c) => c.monto);
    const fechaCobro = s.fechaCobroSaldo ?? s.fecha;
    return saldoOriginal - registradoHasta - (fechaCobro <= fecha ? sinDetalle : 0);
  });
}

export function deudaProveedoresAl(d: DatosContables, fecha: string): number {
  const comprado = suma(hasta(d.compras, fecha).filter((c) => c.aCredito), (c) => c.monto);
  const pagado = suma(hasta(d.movimientos, fecha).filter((m) => m.tipo === 'pago_proveedor'), (m) => m.monto);
  return comprado - pagado;
}

export function prestamosAl(d: DatosContables, fecha: string): number {
  const movs = hasta(d.movimientos, fecha);
  return suma(movs.filter((m) => m.tipo === 'prestamo_recibido'), (m) => m.monto) - suma(movs.filter((m) => m.tipo === 'prestamo_pago'), (m) => m.monto);
}

export function bienesUsoAl(d: DatosContables, fecha: string): { origen: number; amortizacion: number; neto: number } {
  const origen = suma(hasta(d.movimientos, fecha).filter((m) => m.tipo === 'bien_uso'), (m) => m.monto);
  const amortizacion = amortizacionAcumulada(d.movimientos, fecha);
  return { origen, amortizacion, neto: origen - amortizacion };
}

export interface EstadoResultados {
  ventasBrutas: number;
  devoluciones: number;
  ventasNetas: number;
  costoMercaderia: number;
  resultadoBruto: number;
  gastosPorCategoria: { categoria: string; monto: number }[];
  gastosTotal: number;
  /** Mercadería perdida (mermas, roturas, pérdidas, consumo interno), a costo. */
  perdidasMercaderia: number;
  amortizaciones: number;
  resultadoNeto: number;
  cantidadVentas: number;
}

/** Resultados devengados de [desde, hasta]: mismas ventas y costos que la vista Contabilidad, más amortizaciones. */
export function estadoResultados(d: DatosContables, desde: string, hastaIncl: string, cantidadVentas: number): EstadoResultados {
  const res = entre(d.resultados, desde, hastaIncl);
  const ventasBrutas = suma(res.filter((r) => !r.esAjuste), (r) => r.ingreso);
  const devoluciones = suma(res.filter((r) => r.esAjuste), (r) => r.ingreso);
  const costoMercaderia = suma(res, (r) => r.cogs);
  const porCategoria = new Map<string, number>();
  for (const g of entre(d.gastos, desde, hastaIncl)) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto);
  const gastosPorCategoria = [...porCategoria].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  const gastosTotal = suma(gastosPorCategoria, (g) => g.monto);
  const amortizaciones = amortizacionAcumulada(d.movimientos, hastaIncl) - amortizacionAcumulada(d.movimientos, sumarDias(desde, -1));
  const perdidasMercaderia = redondear(suma(entre(d.perdidas, desde, hastaIncl), (p) => p.monto));
  const ventasNetas = ventasBrutas + devoluciones;
  const resultadoBruto = ventasNetas - costoMercaderia;
  return {
    ventasBrutas,
    devoluciones,
    ventasNetas,
    costoMercaderia,
    resultadoBruto,
    gastosPorCategoria,
    gastosTotal,
    perdidasMercaderia,
    amortizaciones,
    resultadoNeto: resultadoBruto - gastosTotal - perdidasMercaderia - amortizaciones,
    cantidadVentas,
  };
}

/** Resultado acumulado desde el primer registro hasta el cierre de `fecha`. */
export function resultadoAcumuladoAl(d: DatosContables, fecha: string): number {
  return (
    suma(hasta(d.resultados, fecha), (r) => r.ingreso - r.cogs) -
    suma(hasta(d.gastos, fecha), (g) => g.monto) -
    suma(hasta(d.perdidas, fecha), (p) => p.monto) -
    amortizacionAcumulada(d.movimientos, fecha)
  );
}

/** Aportes de los dueños (en plata y en especie) y retiros, acumulados. */
function aportesYRetirosAl(d: DatosContables, fecha: string) {
  const movs = hasta(d.movimientos, fecha);
  return {
    aportes: suma(movs.filter((m) => m.tipo === 'aporte' || (m.tipo === 'bien_uso' && !m.conCaja)), (m) => m.monto),
    retiros: suma(movs.filter((m) => m.tipo === 'retiro'), (m) => m.monto),
  };
}

export interface Balance {
  fecha: string;
  activo: {
    caja: number;
    cajaEstimada: boolean;
    creditosPorVentas: number;
    bienesDeCambio: number;
    corriente: number;
    bienesDeUsoOrigen: number;
    amortizacionAcumulada: number;
    bienesDeUso: number;
    noCorriente: number;
    total: number;
  };
  pasivo: { deudasComerciales: number; prestamos: number; total: number };
  patrimonioNeto: {
    aportes: number;
    retiros: number;
    resultadosAcumulados: number;
    /** Lo que ya tenía el negocio antes de los registros y ajustes de stock/caja sin explicar. */
    capitalInicialYAjustes: number;
    total: number;
  };
}

/** Estado de situación patrimonial al cierre de `fecha`; `stock` = mercadería valuada a costo a esa fecha. */
export function balanceAl(d: DatosContables, fecha: string, stock: number, caja = movimientosDeCaja(d)): Balance {
  const { saldo, estimada } = cajaAl(d, fecha, caja);
  const creditosPorVentas = creditosPorVentasAl(d.senias, fecha);
  const corriente = saldo + creditosPorVentas + stock;
  const bu = bienesUsoAl(d, fecha);
  const totalActivo = corriente + bu.neto;
  const deudasComerciales = deudaProveedoresAl(d, fecha);
  const prestamos = prestamosAl(d, fecha);
  const totalPasivo = deudasComerciales + prestamos;
  const pn = totalActivo - totalPasivo;
  const { aportes, retiros } = aportesYRetirosAl(d, fecha);
  const resultadosAcumulados = resultadoAcumuladoAl(d, fecha);
  return {
    fecha,
    activo: {
      caja: redondear(saldo),
      cajaEstimada: estimada,
      creditosPorVentas: redondear(creditosPorVentas),
      bienesDeCambio: redondear(stock),
      corriente: redondear(corriente),
      bienesDeUsoOrigen: redondear(bu.origen),
      amortizacionAcumulada: redondear(bu.amortizacion),
      bienesDeUso: redondear(bu.neto),
      noCorriente: redondear(bu.neto),
      total: redondear(totalActivo),
    },
    pasivo: { deudasComerciales: redondear(deudasComerciales), prestamos: redondear(prestamos), total: redondear(totalPasivo) },
    patrimonioNeto: {
      aportes: redondear(aportes),
      retiros: redondear(retiros),
      resultadosAcumulados: redondear(resultadosAcumulados),
      capitalInicialYAjustes: redondear(pn - aportes + retiros - resultadosAcumulados),
      total: redondear(pn),
    },
  };
}

export interface EvolucionPatrimonio {
  inicio: number;
  aportes: number;
  retiros: number;
  resultado: number;
  /** Recuentos de stock (sobrantes/faltantes sin motivo), arqueos de caja y diferencias de valuación. */
  ajustes: number;
  cierre: number;
}

export function evolucionPatrimonio(d: DatosContables, desde: string, hastaIncl: string, inicio: Balance, cierre: Balance, resultado: number): EvolucionPatrimonio {
  const movs = entre(d.movimientos, desde, hastaIncl);
  const aportes = suma(movs.filter((m) => m.tipo === 'aporte' || (m.tipo === 'bien_uso' && !m.conCaja)), (m) => m.monto);
  const retiros = suma(movs.filter((m) => m.tipo === 'retiro'), (m) => m.monto);
  const pnInicio = inicio.patrimonioNeto.total;
  const pnCierre = cierre.patrimonioNeto.total;
  return {
    inicio: pnInicio,
    aportes: redondear(aportes),
    retiros: redondear(retiros),
    resultado: redondear(resultado),
    ajustes: redondear(pnCierre - pnInicio - aportes + retiros - resultado),
    cierre: pnCierre,
  };
}

export interface FlujoEfectivo {
  saldoInicial: number;
  lineas: { concepto: ConceptoCaja; actividad: Actividad; monto: number }[];
  operativas: number;
  inversion: number;
  financiacion: number;
  /** Diferencia entre lo registrado y lo contado en los arqueos del período. */
  diferenciasArqueo: number;
  saldoFinal: number;
}

export function flujoEfectivo(d: DatosContables, desde: string, hastaIncl: string, caja = movimientosDeCaja(d)): FlujoEfectivo {
  const saldoInicial = cajaAl(d, sumarDias(desde, -1), caja).saldo;
  const saldoFinal = cajaAl(d, hastaIncl, caja).saldo;
  const porConcepto = new Map<ConceptoCaja, number>();
  for (const m of entre(caja, desde, hastaIncl)) porConcepto.set(m.concepto, (porConcepto.get(m.concepto) ?? 0) + m.monto);
  const lineas = (Object.keys(ACTIVIDAD_DE) as ConceptoCaja[])
    .filter((c) => porConcepto.has(c))
    .map((concepto) => ({ concepto, actividad: ACTIVIDAD_DE[concepto], monto: redondear(porConcepto.get(concepto)!) }));
  const total = (a: Actividad) => redondear(suma(lineas.filter((l) => l.actividad === a), (l) => l.monto));
  const operativas = total('operativa');
  const inversion = total('inversion');
  const financiacion = total('financiacion');
  return {
    saldoInicial: redondear(saldoInicial),
    lineas,
    operativas,
    inversion,
    financiacion,
    diferenciasArqueo: redondear(saldoFinal - saldoInicial - operativas - inversion - financiacion),
    saldoFinal: redondear(saldoFinal),
  };
}

export interface Indicadores {
  /** Activo corriente / pasivo corriente: >1 = puede pagar sus deudas de corto plazo. */
  liquidez: number | null;
  /** Igual sin contar la mercadería (lo que se puede pagar ya). */
  pruebaAcida: number | null;
  /** Activo / pasivo. */
  solvencia: number | null;
  /** Pasivo / patrimonio neto. */
  endeudamiento: number | null;
  /** Resultado del período / patrimonio neto promedio, en %. */
  rentabilidadPatrimonioPct: number | null;
}

export function indicadores(inicio: Balance, cierre: Balance, resultado: number): Indicadores {
  const div = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : null);
  const pnPromedio = (inicio.patrimonioNeto.total + cierre.patrimonioNeto.total) / 2;
  return {
    liquidez: div(cierre.activo.corriente, cierre.pasivo.total),
    pruebaAcida: div(cierre.activo.corriente - cierre.activo.bienesDeCambio, cierre.pasivo.total),
    solvencia: div(cierre.activo.total, cierre.pasivo.total),
    endeudamiento: cierre.patrimonioNeto.total > 0 ? div(cierre.pasivo.total, cierre.patrimonioNeto.total) : null,
    rentabilidadPatrimonioPct: pnPromedio > 0 ? Math.round((resultado / pnPromedio) * 1000) / 10 : null,
  };
}
