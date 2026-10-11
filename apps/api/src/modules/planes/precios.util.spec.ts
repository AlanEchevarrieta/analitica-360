import { describe, expect, it } from 'vitest';
import { aplicarPorcentaje, emailAumento, inflacionAcumulada, precioEnFecha, preciosEnFecha, primeraFechaPosible, rigeDesde, type FilaPrecio } from './precios.util.js';

const base: FilaPrecio[] = [
  { plan: 'basico', precioMensual: 49_000, vigenteDesde: '2026-10-01', avisadoEl: '2026-09-01' },
  { plan: 'pro', precioMensual: 89_000, vigenteDesde: '2026-10-01', avisadoEl: '2026-09-01' },
];

describe('precios con fecha de vigencia (IPC)', () => {
  it('sin filas usa el precio del código', () => {
    expect(precioEnFecha([], 'ecommerce', '2026-10-11')).toBe(149_000);
  });

  it('un aumento avisado a tiempo rige desde su fecha, no antes', () => {
    const filas = [...base, { plan: 'basico', precioMensual: 52_500, vigenteDesde: '2026-12-01', avisadoEl: '2026-10-11' }];
    expect(precioEnFecha(filas, 'basico', '2026-11-30')).toBe(49_000);
    expect(precioEnFecha(filas, 'basico', '2026-12-01')).toBe(52_500);
    expect(precioEnFecha(filas, 'pro', '2026-12-01')).toBe(89_000);
  });

  it('sin aviso, el aumento no rige nunca', () => {
    const filas = [...base, { plan: 'basico', precioMensual: 52_500, vigenteDesde: '2026-12-01', avisadoEl: null }];
    expect(precioEnFecha(filas, 'basico', '2027-06-01')).toBe(49_000);
  });

  it('si el aviso sale tarde, el precio se corre a 30 días desde el aviso', () => {
    expect(rigeDesde({ vigenteDesde: '2026-12-01', avisadoEl: '2026-11-20' })).toBe('2026-12-20');
    const filas = [...base, { plan: 'basico', precioMensual: 52_500, vigenteDesde: '2026-12-01', avisadoEl: '2026-11-20' }];
    expect(precioEnFecha(filas, 'basico', '2026-12-19')).toBe(49_000);
    expect(precioEnFecha(filas, 'basico', '2026-12-20')).toBe(52_500);
  });

  it('toma el último aumento que ya rige', () => {
    const filas = [
      ...base,
      { plan: 'pro', precioMensual: 95_000, vigenteDesde: '2027-01-01', avisadoEl: '2026-11-01' },
      { plan: 'pro', precioMensual: 101_000, vigenteDesde: '2027-04-01', avisadoEl: '2027-02-01' },
    ];
    expect(preciosEnFecha(filas, '2027-02-15')).toEqual({ basico: 49_000, pro: 95_000, ecommerce: 149_000 });
    expect(precioEnFecha(filas, 'pro', '2027-04-01')).toBe(101_000);
  });

  it('la primera fecha posible es dentro de 30 días', () => {
    expect(primeraFechaPosible('2026-10-11')).toBe('2026-11-10');
  });

  it('el porcentaje se redondea a los $100', () => {
    expect(aplicarPorcentaje(49_000, 7.3)).toBe(52_600);
    expect(aplicarPorcentaje(89_000, 7.3)).toBe(95_500);
  });

  it('inflación acumulada de 3 meses', () => {
    expect(inflacionAcumulada([2, 2, 2])).toBe(6.1);
  });

  it('el email dice el plan propio, la fecha y cómo congelar el precio', () => {
    const e = emailAumento({
      empresa: 'Acacia',
      vigenteDesde: '2026-12-01',
      cambios: [{ plan: 'pro', nombre: 'Pro', antes: 89_000, despues: 95_500 }],
      motivo: 'IPC jul-sep',
      planActual: 'pro',
      urlPlanes: 'https://analitica360.app/planes',
    });
    expect(e.asunto).toContain('1 de diciembre de 2026');
    expect(e.texto).toContain('Tu plan Pro pasa de $89.000 a $95.500 por mes.');
    expect(e.texto).toContain('30 días');
    expect(e.texto).toContain('plan anual');
    expect(e.html).toContain('<a href="https://analitica360.app/planes">');
  });
});
