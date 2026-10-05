/**
 * Alianzas con cámaras y cupones: reglas puras (sin base de datos). Sirven
 * igual para pagos cargados a mano por el admin o cobrados por Mercado Pago.
 *
 * Fechas en AAAA-MM-DD (día de Argentina). Los períodos son semiabiertos:
 * [desde, hasta) — un mensual que arranca el 2026-10-02 cubre hasta el
 * 2026-11-02 (excluido).
 */
import { DIAS_PRUEBA } from '../registro/registro.util.js';
import { MESES_CICLO, PRECIO_MENSUAL, precioLista, type CicloFacturacion, type PlanPagoId } from '../planes/planes.util.js';

export type TipoCupon = 'camara' | 'descuento' | 'referido';

/** Un tramo del primer período pago: `meses` meses con `porcentaje` de descuento sobre la lista. */
export interface TramoEntrada {
  meses: number;
  porcentaje: number;
}

/** Reglas de un cupón para un ciclo de facturación (configurables por código). */
export interface ReglaCiclo {
  /** Descuento del primer período pago, mes a mes (ej. anual UCIM: 3 meses al 40% y 9 al 20%). Meses sin tramo: sin descuento. */
  entrada: TramoEntrada[];
  /** Cuántos períodos de este ciclo llevan el descuento de entrada (normalmente 1). */
  periodosEntrada: number;
  /** Descuento sobre la lista en las renovaciones. */
  renovacionPct: number;
  /** Cuántas renovaciones llevan ese descuento; null = todas, sin límite. */
  renovacionPeriodos: number | null;
  /**
   * En cuántas cuotas sin interés se paga cada período de este ciclo (primero y
   * renovaciones). null = las cuotas generales del plan (las de quien no tiene código).
   */
  cuotas: number | null;
}

/** Cuotas sin interés generales (clientes sin código), por ciclo. El mensual siempre va en 1. */
export type CuotasGenerales = Partial<Record<CicloFacturacion, number>>;

export type ReglasCupon = Partial<Record<CicloFacturacion, ReglaCiclo>>;

/** Tramo de comisión de una cámara según el número de orden del cliente (hasta: null = sin tope). */
export interface TramoComision {
  desde: number;
  hasta: number | null;
  porcentaje: number;
}

export interface CuponParaValidar {
  activo: boolean;
  desde: string | null;
  hasta: string | null;
  maxUsos: number | null;
  usos: number;
  /** La cámara del cupón (si tiene) también tiene que estar activa. */
  camaraActiva?: boolean | null;
}

export type MotivoRechazo = 'no_existe' | 'inactivo' | 'todavia_no_vigente' | 'vencido' | 'sin_usos';

export const MENSAJES_RECHAZO: Record<MotivoRechazo, string> = {
  no_existe: 'Ese código no existe. Revisalo o seguí sin código.',
  inactivo: 'Ese código ya no está disponible. Podés seguir sin código.',
  todavia_no_vigente: 'Ese código todavía no está habilitado. Podés seguir sin código.',
  vencido: 'Ese código está vencido. Podés seguir sin código.',
  sin_usos: 'Ese código ya alcanzó su límite de usos. Podés seguir sin código.',
};

/** "ucim 360", " Ucim360 " → "UCIM360": sin espacios y en mayúsculas. */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\s+/g, '').toUpperCase();
}

export function validarCupon(cupon: CuponParaValidar | null, hoy: string): { ok: true } | { ok: false; motivo: MotivoRechazo; mensaje: string } {
  const rechazo = (motivo: MotivoRechazo) => ({ ok: false as const, motivo, mensaje: MENSAJES_RECHAZO[motivo] });
  if (!cupon) return rechazo('no_existe');
  if (!cupon.activo || cupon.camaraActiva === false) return rechazo('inactivo');
  if (cupon.desde && hoy < cupon.desde) return rechazo('todavia_no_vigente');
  if (cupon.hasta && hoy > cupon.hasta) return rechazo('vencido');
  if (cupon.maxUsos != null && cupon.usos >= cupon.maxUsos) return rechazo('sin_usos');
  return { ok: true };
}

/** Qué se encontró en el historial de quien intenta usar el beneficio de prueba. */
export interface HistorialPrueba {
  emailUsoBeneficio: boolean;
  usuarioUsoBeneficio: boolean;
  empresaUsoBeneficio: boolean;
  cuitUsoBeneficio: boolean;
  /** Ya tuvo una prueba gratis (14 días o de un cupón) con cualquier empresa. */
  tuvoPrueba: boolean;
}

/** El mes gratis es de un solo uso: no si ya lo usó (por email, usuario, empresa o CUIT) ni si ya tuvo una prueba. */
export function puedeUsarPruebaDelCupon(h: HistorialPrueba): boolean {
  return !(h.emailUsoBeneficio || h.usuarioUsoBeneficio || h.empresaUsoBeneficio || h.cuitUsoBeneficio || h.tuvoPrueba);
}

/** Días de prueba: los del cupón (reemplazan a los 14, no se suman) si corresponde; si no, la prueba común. */
export function diasDePrueba(diasCupon: number | null | undefined, elegible: boolean): number {
  return diasCupon && elegible ? diasCupon : DIAS_PRUEBA;
}

// ---- Fechas -------------------------------------------------------------

function partes(fecha: string): [number, number, number] {
  const [y, m, d] = fecha.split('-').map(Number);
  return [y, m, d];
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = partes(fecha);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Suma meses de calendario; si el día no existe en el mes destino, queda el último día (31/01 + 1 mes = 28/02). */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = partes(fecha);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

function dias(desde: string, hasta: string): number {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Meses (con fracción por días) entre dos fechas: los meses enteros de
 * calendario más los días que sobran como fracción del mes siguiente.
 * Así un período que coincide con meses enteros da justo 6/12, y uno que
 * corta a mitad de mes se prorratea por días.
 */
export function mesesEntre(desde: string, hasta: string): number {
  if (hasta <= desde) return 0;
  let enteros = 0;
  while (sumarMeses(desde, enteros + 1) <= hasta) enteros += 1;
  const inicioResto = sumarMeses(desde, enteros);
  const resto = dias(inicioResto, hasta);
  return resto === 0 ? enteros : enteros + resto / dias(inicioResto, sumarMeses(desde, enteros + 1));
}

// ---- Precios ------------------------------------------------------------

export type TipoPeriodo = 'entrada' | 'renovacion';

export interface Cotizacion {
  plan: PlanPagoId;
  ciclo: CicloFacturacion;
  tipo: TipoPeriodo;
  /** Precio de lista del período completo. */
  lista: number;
  /** Lo que se cobra por el período (con el descuento del cupón, si hay). */
  total: number;
  descuento: number;
  /** Cuotas en las que se puede pagar este período y el monto de cada una. */
  cuotas: number;
  montoCuota: number;
  /** Qué se aplicó, para guardar en el pago. */
  regla: 'sin_cupon' | 'entrada' | 'renovacion' | 'sin_descuento';
}

const redondear = (n: number) => Math.round(n);

/**
 * Precio de un período. Siempre sobre el precio de LISTA y con un solo
 * descuento por mes (no se acumulan). `indiceRenovacion` empieza en 1.
 */
export function cotizarPeriodo(
  plan: PlanPagoId,
  ciclo: CicloFacturacion,
  regla: ReglaCiclo | null | undefined,
  tipo: TipoPeriodo,
  indiceRenovacion = 1,
  cuotasGenerales: CuotasGenerales = {},
  /** Precio especial acordado con la empresa para este plan (reemplaza al de lista). */
  precioMensual?: number | null,
): Cotizacion {
  const lista = precioMensual != null ? precioMensual * MESES_CICLO[ciclo] : precioLista(plan, ciclo);
  const base = { plan, ciclo, tipo, lista };
  const cuotas = cuotasDelPeriodo(ciclo, regla, cuotasGenerales);
  if (!regla) return { ...base, total: lista, descuento: 0, cuotas, montoCuota: redondear(lista / cuotas), regla: 'sin_cupon' };

  let total: number;
  if (tipo === 'entrada') {
    const listaMes = precioMensual ?? PRECIO_MENSUAL[plan];
    let restantes = MESES_CICLO[ciclo];
    total = 0;
    for (const tramo of regla.entrada) {
      const meses = Math.min(tramo.meses, restantes);
      total += redondear(listaMes * meses * (1 - tramo.porcentaje / 100));
      restantes -= meses;
      if (restantes <= 0) break;
    }
    total += listaMes * Math.max(0, restantes);
  } else {
    const conDescuento = regla.renovacionPeriodos == null || indiceRenovacion <= regla.renovacionPeriodos;
    total = conDescuento ? redondear(lista * (1 - regla.renovacionPct / 100)) : lista;
  }

  const descuento = lista - total;
  return { ...base, total, descuento, cuotas, montoCuota: redondear(total / cuotas), regla: descuento > 0 ? tipo : 'sin_descuento' };
}

/** Cuotas de un período: las del cupón si las define; si no, las generales del plan. El mensual, siempre 1. */
export function cuotasDelPeriodo(ciclo: CicloFacturacion, regla: ReglaCiclo | null | undefined, generales: CuotasGenerales = {}): number {
  if (ciclo === 'mensual') return 1;
  return Math.max(1, regla?.cuotas ?? generales[ciclo] ?? 1);
}

/** Montos de cada cuota: la última absorbe el redondeo para que sumen justo el total. */
export function montosCuotas(total: number, cuotas: number): number[] {
  const cuota = redondear(total / cuotas);
  return Array.from({ length: cuotas }, (_, i) => (i < cuotas - 1 ? cuota : total - cuota * (cuotas - 1)));
}

/**
 * ¿El próximo período es de entrada o renovación? Entrada solo mientras el
 * cliente no haya pagado otro período (de cualquier ciclo) más allá de los
 * de entrada de este mismo ciclo: si entra trimestral y se pasa al anual, el
 * anual es renovación.
 */
export function tipoDelProximoPeriodo(
  periodosPagados: { ciclo: CicloFacturacion }[],
  ciclo: CicloFacturacion,
  regla: ReglaCiclo | null | undefined,
): { tipo: TipoPeriodo; indiceRenovacion: number } {
  const otrosCiclos = periodosPagados.some((p) => p.ciclo !== ciclo);
  const mismos = periodosPagados.filter((p) => p.ciclo === ciclo).length;
  const entradas = regla?.periodosEntrada ?? 1;
  if (!otrosCiclos && mismos < entradas) return { tipo: 'entrada', indiceRenovacion: 0 };
  return { tipo: 'renovacion', indiceRenovacion: Math.max(1, mismos - (otrosCiclos ? 0 : entradas) + 1) };
}

// ---- Comisiones ---------------------------------------------------------

/** Tramos por defecto (UCIM): 1-50 → 20%, 51-75 → 25%, 76-100 → 30%, 101-150 → 35%, 151+ → 40%. */
export const TRAMOS_UCIM: TramoComision[] = [
  { desde: 1, hasta: 50, porcentaje: 20 },
  { desde: 51, hasta: 75, porcentaje: 25 },
  { desde: 76, hasta: 100, porcentaje: 30 },
  { desde: 101, hasta: 150, porcentaje: 35 },
  { desde: 151, hasta: null, porcentaje: 40 },
];

/** Porcentaje del cliente número `orden` de la cámara (escalonado, no retroactivo). */
export function porcentajePorOrden(tramos: TramoComision[], orden: number): number {
  const tramo = tramos.find((t) => orden >= t.desde && (t.hasta == null || orden <= t.hasta));
  if (tramo) return tramo.porcentaje;
  // Más allá del último tramo definido: el del último (tope).
  return [...tramos].sort((a, b) => b.desde - a.desde)[0]?.porcentaje ?? 0;
}

/** Tramo actual de la cámara y cuántos clientes faltan para el siguiente. */
export function tramoActual(tramos: TramoComision[], clientesConNumero: number): { porcentaje: number; faltanParaSiguiente: number | null; siguientePorcentaje: number | null } {
  const proximo = clientesConNumero + 1;
  const porcentaje = porcentajePorOrden(tramos, proximo);
  const ordenados = [...tramos].sort((a, b) => a.desde - b.desde);
  const siguiente = ordenados.find((t) => t.desde > proximo);
  return {
    porcentaje,
    faltanParaSiguiente: siguiente ? siguiente.desde - proximo : null,
    siguientePorcentaje: siguiente?.porcentaje ?? null,
  };
}

/**
 * Número de orden de cada cliente dentro de la cámara: por fecha del primer
 * pago (los que nunca pagaron no ocupan número). Desempate por fecha de carga.
 */
export function asignarOrdenes<T extends { id: string; primerPago: string | null; cargado?: string }>(clientes: T[], tramos: TramoComision[]) {
  return clientes
    .filter((c) => c.primerPago)
    .sort((a, b) => a.primerPago!.localeCompare(b.primerPago!) || (a.cargado ?? '').localeCompare(b.cargado ?? '') || a.id.localeCompare(b.id))
    .map((c, i) => ({ id: c.id, orden: i + 1, porcentaje: porcentajePorOrden(tramos, i + 1) }));
}

/** Fin (excluido) de la comisión: `meses` meses desde el inicio del primer período pago. */
export function finDeComision(inicioPrimerPeriodo: string, meses: number): string {
  return sumarMeses(inicioPrimerPeriodo, meses);
}

export interface LineaComision {
  base: number;
  /** Fracción del período pagado que cae dentro de la ventana de comisión (0 a 1). */
  proporcion: number;
  porcentaje: number;
  monto: number;
  /** Parte del período que se comisiona. */
  desde: string | null;
  hasta: string | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Comisión de un pago: sobre lo cobrado de verdad (después del descuento),
 * solo por la parte del período que cae dentro de [inicioVentana, finVentana).
 */
export function comisionDePago(p: {
  montoCobrado: number;
  periodoDesde: string;
  periodoHasta: string;
  inicioVentana: string;
  finVentana: string;
  porcentaje: number;
}): LineaComision {
  const desde = p.periodoDesde > p.inicioVentana ? p.periodoDesde : p.inicioVentana;
  const hasta = p.periodoHasta < p.finVentana ? p.periodoHasta : p.finVentana;
  const total = mesesEntre(p.periodoDesde, p.periodoHasta);
  const dentro = hasta > desde ? mesesEntre(desde, hasta) : 0;
  const proporcion = total > 0 ? Math.min(1, dentro / total) : 0;
  return {
    base: p.montoCobrado,
    proporcion: Math.round(proporcion * 1e6) / 1e6,
    porcentaje: p.porcentaje,
    monto: centavos(p.montoCobrado * proporcion * (p.porcentaje / 100)),
    desde: dentro > 0 ? desde : null,
    hasta: dentro > 0 ? hasta : null,
  };
}

/** Devolución de un pago: la misma comisión en negativo (las líneas originales no se tocan). */
export function ajustePorDevolucion(original: Pick<LineaComision, 'base' | 'proporcion' | 'porcentaje' | 'monto' | 'desde' | 'hasta'>): LineaComision {
  return { ...original, base: -original.base, monto: -original.monto };
}

/** Meses de comisión que le quedan a un cliente (enteros, hacia abajo) y si ya terminó. */
export function mesesRestantesDeComision(hoy: string, finVentana: string | null): number | null {
  if (!finVentana) return null;
  return hoy >= finVentana ? 0 : Math.floor(mesesEntre(hoy, finVentana));
}

/** Primer día del mes de una fecha: el mes en que se liquida una comisión. */
export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/** Días que un cliente sigue contando como activo después de que vence lo que pagó (igual que la gracia del acceso). */
export const DIAS_GRACIA_CLIENTE = 7;

export type EstadoCliente = 'prueba' | 'sin_convertir' | 'activo' | 'baja';

/**
 * Estado de un cliente de la cámara: en mes gratis, nunca pagó, activo
 * (cubierto por lo que pagó, con unos días de gracia) o baja.
 */
export function estadoCliente(c: { primerPagoEn: string | null; pruebaHasta: string | null; coberturaHasta: string | null }, hoy: string): EstadoCliente {
  if (!c.primerPagoEn) return c.pruebaHasta && hoy < c.pruebaHasta ? 'prueba' : 'sin_convertir';
  if (c.coberturaHasta && hoy < sumarDias(c.coberturaHasta, DIAS_GRACIA_CLIENTE)) return 'activo';
  return 'baja';
}

/** Reglas del cupón UCIM360 (2026-10-02). */
export const REGLAS_UCIM: ReglasCupon = {
  mensual: { entrada: [], periodosEntrada: 1, renovacionPct: 0, renovacionPeriodos: null, cuotas: 1 },
  trimestral: { entrada: [{ meses: 3, porcentaje: 40 }], periodosEntrada: 1, renovacionPct: 0, renovacionPeriodos: null, cuotas: 3 },
  anual: {
    entrada: [
      { meses: 3, porcentaje: 40 },
      { meses: 9, porcentaje: 20 },
    ],
    periodosEntrada: 1,
    renovacionPct: 20,
    renovacionPeriodos: null,
    cuotas: 3,
  },
};

// ---- Beneficios en palabras (para Planes y el registro) -----------------

const NOMBRE_PERIODO: Record<CicloFacturacion, { nombre: string; primero: string; renovacion: string }> = {
  mensual: { nombre: 'Mensual', primero: 'tu primer mes pago', renovacion: 'los meses siguientes' },
  trimestral: { nombre: 'Trimestral', primero: 'tu primer trimestre', renovacion: 'las renovaciones' },
  anual: { nombre: 'Anual', primero: 'tu primer año', renovacion: 'las renovaciones' },
};

/** Descuento total del primer período sobre la lista (ej. anual 3×40% + 9×20% → 25). */
export function descuentoDeEntrada(ciclo: CicloFacturacion, regla: ReglaCiclo | null | undefined): number {
  if (!regla) return 0;
  const meses = MESES_CICLO[ciclo];
  let restantes = meses;
  let suma = 0;
  for (const t of regla.entrada) {
    const m = Math.min(t.meses, restantes);
    suma += m * t.porcentaje;
    restantes -= m;
  }
  return Math.round((suma / meses) * 10) / 10;
}

function textoPrueba(dias: number): string {
  if (dias % 30 === 0) {
    const meses = dias / 30;
    return meses === 1 ? '1 mes gratis para probar todo' : `${meses} meses gratis para probar todo`;
  }
  return `${dias} días gratis para probar todo`;
}

export interface Beneficios {
  /** Lista en lenguaje simple, armada desde las reglas del cupón. */
  lista: string[];
  /** Etiqueta corta por ciclo para las tarjetas (ej. "-40%", "AHORRÁS 25%", "1.er MES GRATIS"); null = sin beneficio. */
  etiquetas: Record<CicloFacturacion, string | null>;
}

/**
 * Beneficios de un cupón en palabras, a partir de sus reglas (nada escrito a
 * mano: un código nuevo muestra los suyos). `conPrueba`: si a esta persona le
 * corresponde la prueba del cupón (es de un solo uso).
 */
export function beneficiosDelCupon(c: { diasPrueba: number | null; reglas: ReglasCupon }, conPrueba: boolean, generales: CuotasGenerales = {}): Beneficios {
  const lista: string[] = [];
  const prueba = Boolean(c.diasPrueba) && conPrueba;
  if (prueba) lista.push(textoPrueba(c.diasPrueba!));

  const etiquetas = { mensual: null, trimestral: null, anual: null } as Record<CicloFacturacion, string | null>;
  for (const ciclo of ['mensual', 'trimestral', 'anual'] as CicloFacturacion[]) {
    const r = c.reglas[ciclo];
    const n = NOMBRE_PERIODO[ciclo];
    const entrada = descuentoDeEntrada(ciclo, r);
    const partes: string[] = [];
    if (r && entrada > 0) {
      const tramos = r.entrada.filter((t) => t.porcentaje > 0 || r.entrada.length > 1);
      const unico = r.entrada.length === 1 && r.entrada[0].meses >= MESES_CICLO[ciclo];
      let texto = unico
        ? `${r.entrada[0].porcentaje}% de descuento en ${r.periodosEntrada > 1 ? `tus primeros ${r.periodosEntrada} ${ciclo === 'anual' ? 'años' : ciclo === 'trimestral' ? 'trimestres' : 'meses'}` : n.primero}`
        : tramos.map((t, i) => `${t.porcentaje}% ${i === 0 ? `los primeros ${t.meses} ${t.meses === 1 ? 'mes' : 'meses'}` : `los ${t.meses} ${t.meses === 1 ? 'mes siguiente' : 'meses siguientes'}`}`).join(' + ');
      const cuotas = cuotasDelPeriodo(ciclo, r, generales);
      if (cuotas > 1) texto += ` (en ${cuotas} cuotas sin interés)`;
      partes.push(texto);
    }
    if (r && r.renovacionPct > 0) {
      const cuantas = r.renovacionPeriodos == null ? `todas ${n.renovacion}` : `${r.renovacionPeriodos === 1 ? 'la primera renovación' : `las primeras ${r.renovacionPeriodos} renovaciones`}`;
      partes.push(`${r.renovacionPct}% en ${cuantas}`);
    }
    if (partes.length) lista.push(`${n.nombre}: ${partes.join(', y ')}`);

    // Etiqueta corta de la tarjeta.
    if (entrada > 0) etiquetas[ciclo] = r!.entrada.length > 1 ? `AHORRÁS ${entrada}%` : `-${entrada}%`;
    else if (r && r.renovacionPct > 0) etiquetas[ciclo] = `-${r.renovacionPct}% AL RENOVAR`;
    else if (prueba && ciclo === 'mensual') etiquetas[ciclo] = '1.er MES GRATIS';
  }
  return { lista, etiquetas };
}
