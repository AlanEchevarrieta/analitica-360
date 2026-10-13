import { describe, expect, it } from 'vitest';
import { estadoAbono, finPeriodo, mensajeAbono, periodoVigente, proximoDesde, sumarMeses } from './abonos.util.js';

const p = (desde: string, hasta: string, sesiones: number | null = null, usadas = 0) => ({ desde, hasta, sesiones, usadas });

describe('abonos', () => {
  it('el período mensual dura un mes de calendario; el paquete, su vigencia', () => {
    expect(finPeriodo('mensual', '2026-10-15', null)).toBe('2026-11-14');
    expect(finPeriodo('mensual', '2026-01-31', null)).toBe('2026-02-27');
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(finPeriodo('paquete', '2026-10-15', 30)).toBe('2026-11-13');
    expect(finPeriodo('paquete', '2026-10-15', null)).toBe('2026-12-13');
  });

  it('renovar a tiempo sigue desde donde terminó; mucho después, desde hoy', () => {
    expect(proximoDesde('2026-10-13', null)).toBe('2026-10-13');
    expect(proximoDesde('2026-10-13', '2026-10-20')).toBe('2026-10-21'); // por adelantado
    expect(proximoDesde('2026-10-25', '2026-10-20')).toBe('2026-10-21'); // 4 días tarde
    expect(proximoDesde('2026-11-30', '2026-10-20')).toBe('2026-11-30'); // volvió después de un mes
  });

  it('estado: sin cobrar, al día, por vencer, vencido, sin sesiones y baja', () => {
    const hoy = '2026-10-13';
    expect(estadoAbono(hoy, false, [])).toBe('sin_cobrar');
    expect(estadoAbono(hoy, false, [p('2026-10-01', '2026-10-31')])).toBe('al_dia');
    expect(estadoAbono(hoy, false, [p('2026-09-20', '2026-10-16')])).toBe('por_vencer');
    expect(estadoAbono(hoy, false, [p('2026-09-20', '2026-10-16'), p('2026-10-17', '2026-11-16')])).toBe('al_dia');
    expect(estadoAbono(hoy, false, [p('2026-09-01', '2026-10-12')])).toBe('vencido');
    expect(estadoAbono(hoy, false, [p('2026-10-01', '2026-10-31', 8, 8)])).toBe('sin_sesiones');
    expect(estadoAbono(hoy, false, [p('2026-10-01', '2026-10-31', 8, 5)])).toBe('al_dia');
    expect(estadoAbono(hoy, true, [p('2026-10-01', '2026-10-31')])).toBe('baja');
  });

  it('el período vigente es el que incluye hoy', () => {
    const periodos = [p('2026-09-13', '2026-10-12'), p('2026-10-13', '2026-11-12')];
    expect(periodoVigente('2026-10-13', periodos)?.desde).toBe('2026-10-13');
    expect(periodoVigente('2026-12-01', periodos)).toBeNull();
  });

  it('el WhatsApp dice qué pasa y cuánto es', () => {
    expect(mensajeAbono({ cliente: 'Laura Pérez', plan: 'Pase libre', estado: 'vencido', hasta: '2026-10-12', deuda: 0, precio: 25000, negocio: 'Gym Sur' })).toBe(
      'Hola Laura! Tu Pase libre venció el 12/10. La renovación es de $25.000.\nGym Sur',
    );
    expect(mensajeAbono({ cliente: 'Juan', plan: '8 clases', estado: 'al_dia', hasta: '2026-11-12', deuda: 5000, precio: 20000, negocio: 'Yoga' })).toContain('saldo pendiente de $5.000');
  });
});
