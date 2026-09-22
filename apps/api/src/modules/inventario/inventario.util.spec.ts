import { deltaStockKardex, estadoLote, signoDeAjuste, sumarDiasIso } from './inventario.util.js';

describe('sumarDiasIso', () => {
  it('suma días cruzando de mes', () => {
    expect(sumarDiasIso('2026-09-25', 10)).toBe('2026-10-05');
  });
});

describe('estadoLote', () => {
  const hoy = '2026-09-22';

  it('sin_vencimiento cuando no hay fecha', () => {
    expect(estadoLote(null, hoy)).toBe('sin_vencimiento');
  });

  it('vencido cuando la fecha ya pasó', () => {
    expect(estadoLote('2026-09-21', hoy)).toBe('vencido');
  });

  it('por_vencer dentro de la ventana de 29 días', () => {
    expect(estadoLote('2026-10-21', hoy)).toBe('por_vencer'); // +29 días exacto
  });

  it('vigente más allá de la ventana', () => {
    expect(estadoLote('2026-10-22', hoy)).toBe('vigente'); // +30 días
  });
});

describe('deltaStockKardex', () => {
  it('las transferencias no aportan al delta total', () => {
    expect(deltaStockKardex('transferencia', 10, 1)).toBe(0);
    expect(deltaStockKardex('transferencia', 10, -1)).toBe(0);
  });

  it('el resto de los tipos suma cantidad*signo', () => {
    expect(deltaStockKardex('venta', 5, -1)).toBe(-5);
    expect(deltaStockKardex('compra', 5, 1)).toBe(5);
  });
});

describe('signoDeAjuste', () => {
  it('ajuste_positivo es +1, el resto es -1', () => {
    expect(signoDeAjuste('ajuste_positivo')).toBe(1);
    expect(signoDeAjuste('ajuste_negativo')).toBe(-1);
    expect(signoDeAjuste('merma')).toBe(-1);
    expect(signoDeAjuste('rotura')).toBe(-1);
    expect(signoDeAjuste('perdida')).toBe(-1);
    expect(signoDeAjuste('consumo_interno')).toBe(-1);
  });
});
