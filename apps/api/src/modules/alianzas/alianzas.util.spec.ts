import { describe, expect, it } from 'vitest';
import { precioLista } from '../planes/planes.util.js';
import {
  ajustePorDevolucion,
  beneficiosDelCupon,
  cuotasDelPeriodo,
  asignarOrdenes,
  comisionDePago,
  cotizarPeriodo,
  diasDePrueba,
  finDeComision,
  mesesEntre,
  mesesRestantesDeComision,
  montosCuotas,
  normalizarCodigo,
  porcentajePorOrden,
  puedeUsarPruebaDelCupon,
  REGLAS_UCIM,
  sumarMeses,
  tipoDelProximoPeriodo,
  TRAMOS_UCIM,
  tramoActual,
  validarCupon,
} from './alianzas.util.js';

const SIN_HISTORIAL = { emailUsoBeneficio: false, usuarioUsoBeneficio: false, empresaUsoBeneficio: false, cuitUsoBeneficio: false, tuvoPrueba: false };
const CUPON_OK = { activo: true, desde: '2026-10-01', hasta: null, maxUsos: null, usos: 0, camaraActiva: true };

describe('prueba gratis', () => {
  it('con UCIM360 dura 1 mes (30 días); sin código, 14 días', () => {
    expect(diasDePrueba(30, true)).toBe(30);
    expect(diasDePrueba(null, true)).toBe(14);
    expect(diasDePrueba(undefined, false)).toBe(14);
  });

  it('el mes gratis es de un solo uso: mismo email, usuario, empresa o CUIT → no corresponde', () => {
    expect(puedeUsarPruebaDelCupon(SIN_HISTORIAL)).toBe(true);
    for (const clave of ['emailUsoBeneficio', 'usuarioUsoBeneficio', 'empresaUsoBeneficio', 'cuitUsoBeneficio', 'tuvoPrueba'] as const) {
      expect(puedeUsarPruebaDelCupon({ ...SIN_HISTORIAL, [clave]: true })).toBe(false);
    }
  });

  it('sin mes gratis, igual tiene la prueba común y los descuentos del cupón', () => {
    expect(diasDePrueba(30, false)).toBe(14);
    expect(cotizarPeriodo('basico', 'trimestral', REGLAS_UCIM.trimestral, 'entrada').total).toBe(88_200);
  });
});

describe('códigos', () => {
  it('no distingue mayúsculas, minúsculas ni espacios', () => {
    expect(normalizarCodigo('ucim 360')).toBe('UCIM360');
    expect(normalizarCodigo('  Ucim360 ')).toBe('UCIM360');
  });

  it('acepta un código vigente y rechaza desactivado, vencido, no habilitado, sin usos o inexistente', () => {
    expect(validarCupon(CUPON_OK, '2026-10-02')).toEqual({ ok: true });
    expect(validarCupon({ ...CUPON_OK, activo: false }, '2026-10-02')).toMatchObject({ ok: false, motivo: 'inactivo' });
    expect(validarCupon({ ...CUPON_OK, camaraActiva: false }, '2026-10-02')).toMatchObject({ ok: false, motivo: 'inactivo' });
    expect(validarCupon({ ...CUPON_OK, hasta: '2026-10-01' }, '2026-10-02')).toMatchObject({ ok: false, motivo: 'vencido' });
    expect(validarCupon({ ...CUPON_OK, desde: '2026-11-01' }, '2026-10-02')).toMatchObject({ ok: false, motivo: 'todavia_no_vigente' });
    expect(validarCupon({ ...CUPON_OK, maxUsos: 5, usos: 5 }, '2026-10-02')).toMatchObject({ ok: false, motivo: 'sin_usos' });
    const r = validarCupon(null, '2026-10-02');
    expect(r).toMatchObject({ ok: false, motivo: 'no_existe' });
    expect(!r.ok && r.mensaje).toMatch(/seguí sin código/);
  });
});

describe('descuentos de UCIM360 (sobre el precio de lista)', () => {
  it('trimestral: el primer trimestre sale 60% de la lista (en 1 pago o 3 cuotas) y la renovación a lista', () => {
    const entrada = cotizarPeriodo('basico', 'trimestral', REGLAS_UCIM.trimestral, 'entrada');
    expect(entrada.lista).toBe(147_000);
    expect(entrada.total).toBe(88_200);
    expect(entrada.total / entrada.lista).toBeCloseTo(0.6, 10);
    expect(entrada.cuotas).toBe(3);
    expect(entrada.montoCuota).toBe(29_400);
    expect(montosCuotas(entrada.total, 3)).toEqual([29_400, 29_400, 29_400]);
    const renovacion = cotizarPeriodo('basico', 'trimestral', REGLAS_UCIM.trimestral, 'renovacion', 1);
    expect(renovacion.total).toBe(147_000);
    expect(renovacion.cuotas).toBe(3); // las cuotas valen también para las renovaciones
  });

  it('anual: el primer año sale 75% de la lista (3 meses al 60% y 9 al 80%, sin sumarse) y todas las renovaciones 80%', () => {
    for (const plan of ['basico', 'pro', 'ecommerce'] as const) {
      const entrada = cotizarPeriodo(plan, 'anual', REGLAS_UCIM.anual, 'entrada');
      expect(entrada.total / precioLista(plan, 'anual')).toBeCloseTo(0.75, 10);
      for (const n of [1, 2, 7]) {
        expect(cotizarPeriodo(plan, 'anual', REGLAS_UCIM.anual, 'renovacion', n).total / precioLista(plan, 'anual')).toBeCloseTo(0.8, 10);
      }
    }
    expect(cotizarPeriodo('basico', 'anual', REGLAS_UCIM.anual, 'entrada').total).toBe(441_000);
  });

  it('mensual con UCIM360: sin descuento', () => {
    const c = cotizarPeriodo('pro', 'mensual', REGLAS_UCIM.mensual, 'entrada');
    expect(c.total).toBe(89_000);
    expect(c.descuento).toBe(0);
    expect(c.regla).toBe('sin_descuento');
  });

  it('sin cupón: siempre precio de lista (ya no hay promociones al público)', () => {
    expect(cotizarPeriodo('ecommerce', 'anual', null, 'entrada')).toMatchObject({ total: 1_788_000, descuento: 0, regla: 'sin_cupon' });
  });

  it('si entra trimestral y se pasa al anual, el anual es renovación (20%)', () => {
    expect(tipoDelProximoPeriodo([], 'trimestral', REGLAS_UCIM.trimestral).tipo).toBe('entrada');
    expect(tipoDelProximoPeriodo([{ ciclo: 'trimestral' }], 'trimestral', REGLAS_UCIM.trimestral).tipo).toBe('renovacion');
    expect(tipoDelProximoPeriodo([{ ciclo: 'trimestral' }], 'anual', REGLAS_UCIM.anual).tipo).toBe('renovacion');
    expect(tipoDelProximoPeriodo([], 'anual', REGLAS_UCIM.anual).tipo).toBe('entrada');
  });
});

describe('tramos de comisión (escalonados, no retroactivos)', () => {
  it('con 100 clientes que pagan: 50 al 20%, 25 al 25% y 25 al 30%; el 151 queda al 40%', () => {
    const clientes = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, primerPago: sumarMeses('2026-01-01', 0).replace('01-01', `01-${String((i % 28) + 1).padStart(2, '0')}`), cargado: String(i).padStart(4, '0') }));
    const conteo = asignarOrdenes(clientes, TRAMOS_UCIM).reduce<Record<number, number>>((acc, c) => ({ ...acc, [c.porcentaje]: (acc[c.porcentaje] ?? 0) + 1 }), {});
    expect(conteo).toEqual({ 20: 50, 25: 25, 30: 25 });
    expect(porcentajePorOrden(TRAMOS_UCIM, 151)).toBe(40);
    expect(porcentajePorOrden(TRAMOS_UCIM, 1000)).toBe(40);
  });

  it('el número se asigna por fecha del primer pago; los que nunca pagaron no ocupan número', () => {
    const r = asignarOrdenes(
      [
        { id: 'tarde', primerPago: '2026-12-01' },
        { id: 'solo-mes-gratis', primerPago: null },
        { id: 'temprano', primerPago: '2026-11-01' },
      ],
      TRAMOS_UCIM,
    );
    expect(r.map((c) => [c.id, c.orden])).toEqual([
      ['temprano', 1],
      ['tarde', 2],
    ]);
  });

  it('tramo actual y cuántos faltan para el siguiente', () => {
    expect(tramoActual(TRAMOS_UCIM, 48)).toEqual({ porcentaje: 20, faltanParaSiguiente: 2, siguientePorcentaje: 25 });
    expect(tramoActual(TRAMOS_UCIM, 200)).toEqual({ porcentaje: 40, faltanParaSiguiente: null, siguientePorcentaje: null });
  });
});

describe('plazo y base de la comisión', () => {
  const inicio = '2026-11-01';
  const fin = finDeComision(inicio, 24);
  const mensual = (mes: number, monto = 49_000) =>
    comisionDePago({ montoCobrado: monto, periodoDesde: sumarMeses(inicio, mes - 1), periodoHasta: sumarMeses(inicio, mes), inicioVentana: inicio, finVentana: fin, porcentaje: 20 });

  it('la ventana es de 24 meses desde el primer pago', () => {
    expect(fin).toBe('2028-11-01');
  });

  it('cliente que se va en el mes 3 pago: 3 meses de comisión y nada más', () => {
    const lineas = [1, 2, 3].map((m) => mensual(m));
    expect(lineas.reduce((a, l) => a + l.monto, 0)).toBe(3 * 9_800);
  });

  it('cliente que se queda 5 años: comisión solo hasta el mes 24', () => {
    const lineas = Array.from({ length: 60 }, (_, i) => mensual(i + 1));
    expect(lineas.filter((l) => l.monto > 0)).toHaveLength(24);
    expect(lineas[24].monto).toBe(0);
  });

  it('un anual renovado en el mes 13 entra completo; uno que cubre los meses 19 a 30 entra 6/12', () => {
    const mes13 = comisionDePago({ montoCobrado: 470_400, periodoDesde: sumarMeses(inicio, 12), periodoHasta: sumarMeses(inicio, 24), inicioVentana: inicio, finVentana: fin, porcentaje: 20 });
    expect(mes13.proporcion).toBe(1);
    const mes19 = comisionDePago({ montoCobrado: 470_400, periodoDesde: sumarMeses(inicio, 18), periodoHasta: sumarMeses(inicio, 30), inicioVentana: inicio, finVentana: fin, porcentaje: 20 });
    expect(mes19.proporcion).toBe(0.5);
    expect(mes19.monto).toBe(470_400 * 0.5 * 0.2);
    expect(mes19).toMatchObject({ desde: sumarMeses(inicio, 18), hasta: fin });
  });

  it('a mitad de mes se prorratea por días', () => {
    expect(mesesEntre('2026-01-01', '2026-01-16')).toBeCloseTo(15 / 31, 10);
  });

  it('la base es lo cobrado después del descuento', () => {
    const cobrado = cotizarPeriodo('basico', 'anual', REGLAS_UCIM.anual, 'entrada').total; // 441.000, no 588.000
    const linea = comisionDePago({ montoCobrado: cobrado, periodoDesde: inicio, periodoHasta: sumarMeses(inicio, 12), inicioVentana: inicio, finVentana: fin, porcentaje: 20 });
    expect(linea.base).toBe(441_000);
    expect(linea.monto).toBe(88_200);
  });

  it('una devolución genera un ajuste en negativo por la misma comisión', () => {
    const original = mensual(1);
    expect(ajustePorDevolucion(original)).toMatchObject({ base: -49_000, monto: -9_800, porcentaje: 20 });
  });

  it('meses de comisión que quedan', () => {
    expect(mesesRestantesDeComision('2027-02-01', fin)).toBe(21);
    expect(mesesRestantesDeComision('2029-01-01', fin)).toBe(0);
  });
});

describe('cuotas sin interés (trimestral y anual, para todos)', () => {
  const GENERALES = { trimestral: 3, anual: 3 };

  it('anual sin código en 3 cuotas: suman la lista y la última absorbe el redondeo', () => {
    const c = cotizarPeriodo('pro', 'anual', null, 'entrada', 1, GENERALES);
    expect(c).toMatchObject({ total: 1_068_000, cuotas: 3, montoCuota: 356_000 });
    expect(montosCuotas(c.total, c.cuotas)).toEqual([356_000, 356_000, 356_000]);
    expect(montosCuotas(100_000, 3)).toEqual([33_333, 33_333, 33_334]);
  });

  it('anual con UCIM360: el primer año en 3 cuotas que suman 75% de la lista', () => {
    const c = cotizarPeriodo('basico', 'anual', REGLAS_UCIM.anual, 'entrada', 1, GENERALES);
    const cuotas = montosCuotas(c.total, c.cuotas);
    expect(cuotas).toHaveLength(3);
    expect(cuotas.reduce((a, b) => a + b, 0)).toBe(441_000);
    expect(cuotas.reduce((a, b) => a + b, 0) / precioLista('basico', 'anual')).toBeCloseTo(0.75, 10);
  });

  it('renovación anual con UCIM360 en cuotas: suman 80% de la lista', () => {
    const c = cotizarPeriodo('ecommerce', 'anual', REGLAS_UCIM.anual, 'renovacion', 2, GENERALES);
    const cuotas = montosCuotas(c.total, c.cuotas);
    expect(cuotas).toHaveLength(3);
    expect(cuotas.reduce((a, b) => a + b, 0) / precioLista('ecommerce', 'anual')).toBeCloseTo(0.8, 10);
  });

  it('el mensual nunca va en cuotas; un cupón sin cuotas propias usa las generales', () => {
    expect(cuotasDelPeriodo('mensual', null, { trimestral: 3 })).toBe(1);
    expect(cuotasDelPeriodo('trimestral', { ...REGLAS_UCIM.trimestral!, cuotas: null }, { trimestral: 6 })).toBe(6);
    expect(cuotasDelPeriodo('anual', REGLAS_UCIM.anual, { anual: 12 })).toBe(3);
    expect(cuotasDelPeriodo('anual', null, {})).toBe(1);
  });
});

describe('beneficios en palabras (armados desde las reglas del cupón)', () => {
  it('UCIM360 para una cuenta nueva: mes gratis, trimestral y anual con sus cuotas', () => {
    const b = beneficiosDelCupon({ diasPrueba: 30, reglas: REGLAS_UCIM }, true);
    expect(b.lista).toEqual([
      '1 mes gratis para probar todo',
      'Trimestral: 40% de descuento en tu primer trimestre (en 3 cuotas sin interés)',
      'Anual: 40% los primeros 3 meses + 20% los 9 meses siguientes (en 3 cuotas sin interés), y 20% en todas las renovaciones',
    ]);
    expect(b.etiquetas).toEqual({ mensual: '1.er MES GRATIS', trimestral: '-40%', anual: 'AHORRÁS 25%' });
  });

  it('si ya usó una prueba, no se promete el mes gratis', () => {
    const b = beneficiosDelCupon({ diasPrueba: 30, reglas: REGLAS_UCIM }, false);
    expect(b.lista[0]).toMatch(/^Trimestral/);
    expect(b.etiquetas.mensual).toBeNull();
  });

  it('un cupón nuevo muestra sus propios beneficios', () => {
    const b = beneficiosDelCupon(
      {
        diasPrueba: 45,
        reglas: { mensual: { entrada: [{ meses: 1, porcentaje: 10 }], periodosEntrada: 2, renovacionPct: 0, renovacionPeriodos: null, cuotas: null }, anual: { entrada: [], periodosEntrada: 1, renovacionPct: 15, renovacionPeriodos: 2, cuotas: 6 } },
      },
      true,
    );
    expect(b.lista).toEqual(['45 días gratis para probar todo', 'Mensual: 10% de descuento en tus primeros 2 meses', 'Anual: 15% en las primeras 2 renovaciones']);
    expect(b.etiquetas).toEqual({ mensual: '-10%', trimestral: null, anual: '-15% AL RENOVAR' });
  });
});

describe('precio especial', () => {
  it('reemplaza al de lista en ese plan (y el cupón se aplica sobre él)', () => {
    expect(cotizarPeriodo('ecommerce', 'mensual', null, 'renovacion', 1, {}, 89000)).toMatchObject({ lista: 89000, total: 89000 });
    expect(cotizarPeriodo('ecommerce', 'anual', null, 'renovacion', 1, {}, 89000)).toMatchObject({ lista: 1068000 });
    expect(cotizarPeriodo('ecommerce', 'mensual', null, 'renovacion')).toMatchObject({ lista: 149000 });
  });
});
