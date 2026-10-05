import { describe, expect, it } from 'vitest';
import { cotizarPeriodo, tipoDelProximoPeriodo } from './alianzas.util.js';
import { aplicarPremios, codigoReferido, estadoPremioNuevo, porcentajePremios, reglasReferido } from './referidos.util.js';

describe('referidos', () => {
  it('el código: la primera palabra del nombre, sin tildes y 3 caracteres que no se confunden', () => {
    let i = 0;
    const azar = () => [0, 0.5, 0.99][i++ % 3];
    expect(codigoReferido('Acacia Mates', azar)).toBe('ACACIA-AS9');
    expect(codigoReferido('Ñandú & Cía.', azar)).toMatch(/^NANDU-[A-Z2-9]{3}$/);
    expect(codigoReferido('La Pe Mates', azar)).toMatch(/^LAPE-/); // palabras cortas: se juntan hasta 4 letras
    expect(codigoReferido('!!!', azar)).toMatch(/^AMIGO-/);
    for (let n = 0; n < 50; n++) expect(codigoReferido('x'.repeat(30)).split('-')[1]).toMatch(/^[A-HJKMNP-Z2-9]{3}$/);
  });

  it('el nuevo paga 10% menos su primer período, cualquiera sea el ciclo; después, precio normal', () => {
    const r = reglasReferido();
    expect(cotizarPeriodo('pro', 'mensual', r.mensual, 'entrada').total).toBe(80_100);
    expect(cotizarPeriodo('basico', 'anual', r.anual, 'entrada').total).toBe(529_200); // 588.000 − 10%
    expect(tipoDelProximoPeriodo([{ ciclo: 'mensual' }], 'mensual', r.mensual).tipo).toBe('renovacion');
    expect(cotizarPeriodo('pro', 'mensual', r.mensual, 'renovacion', 1).total).toBe(89_000);
  });

  it('los premios se suman, con un máximo de 6 (60%)', () => {
    expect(porcentajePremios([])).toBe(0);
    expect(porcentajePremios([10, 10, 10])).toBe(30);
    expect(porcentajePremios(Array(9).fill(10))).toBe(60);
  });

  it('se aplican sobre el precio del período, después del descuento del código', () => {
    const conCodigo = cotizarPeriodo('basico', 'mensual', null, 'renovacion');
    const c = aplicarPremios(conCodigo, 30);
    expect(c).toMatchObject({ total: 34_300, descuento: 14_700, referidosPct: 30, montoCuota: 34_300 });
    expect(aplicarPremios(conCodigo, 0)).toBe(conCodigo);
  });

  it('a partir del séptimo premio del año, queda fuera de tope', () => {
    expect(estadoPremioNuevo(0)).toBe('disponible');
    expect(estadoPremioNuevo(5)).toBe('disponible');
    expect(estadoPremioNuevo(6)).toBe('tope');
  });
});
