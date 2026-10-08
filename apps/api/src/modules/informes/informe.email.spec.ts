import { describe, expect, it } from 'vitest';
import type { DatosInforme } from './informes-datos.service.js';
import { htmlInforme, textoInforme } from './informe.email.js';
import { pdfInforme } from './informe.pdf.js';

const cifra = (valor: number) => ({ valor, anterior: valor, variacion: 0 });
const base: DatosInforme = {
  empresa: 'Mates <Prueba>',
  tipo: 'semanal',
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  ventas: cifra(1_000_000),
  cantidad: cifra(40),
  ticket: cifra(25_000),
  ganancia: cifra(300_000),
  margenPct: 30,
  dias: [],
  masVendidos: [],
  formasPago: [],
  compras: cifra(0),
  stockBajo: [],
  sinVentas: { cantidad: 0, ejemplos: [] },
  cuentaCorriente: null,
  monotributo: null,
  demasiadasVentas: false,
};

describe('informe con objetivos', () => {
  const objetivos = [{ linea: 'Facturación mensual · Toda la empresa: $ 5.800.000, meta $ 8.000.000 (72 %) · en camino', semaforo: 'bien' as const }];

  it('el email y el texto los listan', () => {
    expect(htmlInforme({ ...base, objetivos }, 'https://app', 'https://baja')).toContain('Tus objetivos, hoy:');
    expect(htmlInforme({ ...base, objetivos }, 'https://app', 'https://baja')).toContain('$ 5.800.000');
    expect(textoInforme({ ...base, objetivos }, 'https://app', 'https://baja')).toContain('- Facturación mensual · Toda la empresa');
  });

  it('sin objetivos no aparece la sección', () => {
    expect(htmlInforme(base, 'https://app', 'https://baja')).not.toContain('Tus objetivos');
    expect(textoInforme({ ...base, objetivos: [] }, 'https://app', 'https://baja')).not.toContain('Tus objetivos');
  });

  it('el PDF se arma con objetivos', async () => {
    const pdf = await pdfInforme({ ...base, objetivos: Array.from({ length: 8 }, () => objetivos[0]) });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
