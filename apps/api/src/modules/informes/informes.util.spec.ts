import { describe, expect, it } from 'vitest';
import { pdfInforme } from './informe.pdf.js';
import type { DatosInforme } from './informes-datos.service.js';
import { completarDias, destinatarios, informePendiente, leerTokenBaja, nombrePeriodo, periodoCerrado, periodoPrevio, tokenBaja, variacion } from './informes.util.js';

// Instantes en hora de Argentina (UTC-3).
const ar = (dia: string, hora: number) => new Date(`${dia}T${String(hora).padStart(2, '0')}:30:00-03:00`);

describe('períodos', () => {
  it('semana cerrada: de lunes a domingo, la anterior a la de hoy', () => {
    expect(periodoCerrado('semanal', '2026-10-05')).toEqual({ desde: '2026-09-28', hasta: '2026-10-04' }); // lunes
    expect(periodoCerrado('semanal', '2026-10-04')).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' }); // domingo
  });

  it('mes cerrado: el anterior completo (también en enero y con febrero)', () => {
    expect(periodoCerrado('mensual', '2026-10-01')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(periodoCerrado('mensual', '2027-01-15')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
    expect(periodoCerrado('mensual', '2028-03-01')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });

  it('el período para comparar es el de justo antes', () => {
    expect(periodoPrevio('semanal', { desde: '2026-09-28', hasta: '2026-10-04' })).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' });
    expect(periodoPrevio('mensual', { desde: '2026-03-01', hasta: '2026-03-31' })).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
  });

  it('nombres legibles', () => {
    expect(nombrePeriodo('semanal', { desde: '2026-09-28', hasta: '2026-10-04' })).toBe('Semana del 28/09 al 04/10/2026');
    expect(nombrePeriodo('mensual', { desde: '2026-09-01', hasta: '2026-09-30' })).toBe('Septiembre 2026');
  });
});

describe('cuándo sale', () => {
  it('el semanal sale el lunes desde las 8 (hora de Argentina), no antes', () => {
    expect(informePendiente('semanal', ar('2026-10-05', 7))).toBeNull();
    expect(informePendiente('semanal', ar('2026-10-05', 8))).toEqual({ desde: '2026-09-28', hasta: '2026-10-04' });
  });

  it('si el servidor estuvo apagado se pone al día, pero no días después', () => {
    expect(informePendiente('semanal', ar('2026-10-07', 10))).toEqual({ desde: '2026-09-28', hasta: '2026-10-04' });
    expect(informePendiente('semanal', ar('2026-10-08', 10))).toBeNull();
  });

  it('el mensual sale el día 1 desde las 8', () => {
    expect(informePendiente('mensual', ar('2026-10-01', 7))).toBeNull();
    expect(informePendiente('mensual', ar('2026-10-01', 8))).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(informePendiente('mensual', ar('2026-10-06', 9))).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(informePendiente('mensual', ar('2026-10-07', 9))).toBeNull();
  });

  it('a las 23 h del domingo en Argentina (ya lunes en UTC) todavía no sale', () => {
    expect(informePendiente('semanal', ar('2026-10-04', 23))).toBeNull();
  });
});

describe('cuentas', () => {
  it('variación porcentual, sin base no compara', () => {
    expect(variacion(120, 100)).toBe(20);
    expect(variacion(50, 200)).toBe(-75);
    expect(variacion(10, 0)).toBeNull();
  });

  it('completa los días sin ventas con 0', () => {
    expect(completarDias({ desde: '2026-09-28', hasta: '2026-09-30' }, [{ fecha: '2026-09-29', total: 5 }])).toEqual([
      { fecha: '2026-09-28', total: 0 },
      { fecha: '2026-09-29', total: 5 },
      { fecha: '2026-09-30', total: 0 },
    ]);
  });

  it('destinatarios: dueños + extras, sin repetir y sin las bajas de ese tipo', () => {
    expect(destinatarios(['Ana@x.com', 'beto@x.com'], ['contador@y.com', 'ana@x.com', 'no-es-email'], ['semanal:beto@x.com', 'mensual:contador@y.com'], 'semanal')).toEqual(['ana@x.com', 'contador@y.com']);
  });
});

describe('baja desde el email', () => {
  const S = 'secreto-de-prueba';
  it('el token firmado se lee; si lo tocan, no', () => {
    const t = tokenBaja(S, 'emp-1', 'mensual', 'ana@x.com');
    expect(leerTokenBaja(S, t)).toEqual({ empresaId: 'emp-1', tipo: 'mensual', email: 'ana@x.com' });
    const [datos, firma] = t.split('.');
    const otro = Buffer.from(JSON.stringify(['emp-2', 'mensual', 'ana@x.com'])).toString('base64url');
    expect(leerTokenBaja(S, `${otro}.${firma}`)).toBeNull();
    expect(leerTokenBaja('otro-secreto', t)).toBeNull();
    expect(leerTokenBaja(S, datos)).toBeNull();
    expect(leerTokenBaja(S, 'basura')).toBeNull();
  });
});

describe('PDF', () => {
  const cifra = (valor: number, anterior: number) => ({ valor, anterior, variacion: variacion(valor, anterior) });
  const base: DatosInforme = {
    empresa: 'Acacia Ñandú',
    tipo: 'semanal',
    periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
    ventas: cifra(1_234_567, 1_000_000),
    cantidad: cifra(42, 40),
    ticket: cifra(29_394, 25_000),
    ganancia: cifra(500_000, 520_000),
    margenPct: 40.5,
    dias: completarDias({ desde: '2026-09-28', hasta: '2026-10-04' }, [{ fecha: '2026-10-02', total: 300_000 }]),
    masVendidos: [{ nombre: 'Mate de calabaza con virola de alpaca, edición muy larga para probar el corte', unidades: 12, total: 240_000 }],
    formasPago: [{ nombre: 'Efectivo', total: 600_000, cantidad: 20 }],
    compras: cifra(200_000, 0),
    stockBajo: [{ nombre: 'Bombilla', stock: 1 }],
    sinVentas: { cantidad: 7, ejemplos: ['Termo', 'Yerbera'] },
    cuentaCorriente: null,
    monotributo: null,
    demasiadasVentas: false,
  };

  it('el semanal sale en una página', async () => {
    const pdf = await pdfInforme(base);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
  });

  it('el mensual con cuenta corriente y monotributo también se genera', async () => {
    const pdf = await pdfInforme({
      ...base,
      tipo: 'mensual',
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      dias: completarDias({ desde: '2026-09-01', hasta: '2026-09-30' }, []),
      cuentaCorriente: { total: 90_000, deudores: [{ nombre: 'Juan', saldo: 90_000, dias: 40 }] },
      monotributo: { categoria: 'D', usoPct: 82, margenDisponible: 1_500_000, proyeccionAnual: 12_000_000, categoriaProyectada: 'E' },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeLessThanOrEqual(2);
  });
});
