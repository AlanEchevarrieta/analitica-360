import { kardexValorizado, type MovimientoKardex } from './kardex.util.js';

let n = 0;
const mov = (fecha: string, tipo: string, cantidad: number, signo: 1 | -1, costoUnitario: number | null = null): MovimientoKardex => ({
  id: String(++n).padStart(4, '0'),
  fecha,
  fechaHora: new Date(`${fecha}T12:00:00Z`),
  tipo,
  cantidad,
  signo,
  costoUnitario,
  varianteId: null,
  motivo: null,
  referenciaId: null,
  usuario: null,
});

describe('kardex valorizado (PPP)', () => {
  it('promedia las compras y valúa las salidas al promedio vigente', () => {
    const k = kardexValorizado(
      [
        mov('2026-01-01', 'compra', 10, 1, 100),
        mov('2026-01-05', 'venta', 4, -1, 100),
        mov('2026-01-10', 'compra', 6, 1, 200), // 6 × 100 + 6 × 200 = 1800 / 12 = 150
        mov('2026-01-12', 'venta', 2, -1),
        mov('2026-01-15', 'rotura', 1, -1),
      ],
      '2026-01-01',
      '2026-01-31',
      null,
    );
    expect(k.filas.map((f) => [f.saldoCantidad, f.costoPromedio, f.saldoValor])).toEqual([
      [10, 100, 1000],
      [6, 100, 600],
      [12, 150, 1800],
      [10, 150, 1500],
      [9, 150, 1350],
    ]);
    expect(k.entradas).toEqual({ cantidad: 16, valor: 2200 });
    expect(k.salidas).toEqual({ cantidad: 7, valor: 850 });
    expect(k.perdidas).toEqual({ cantidad: 1, valor: 150 });
    expect(k.final).toEqual({ cantidad: 9, costoPromedio: 150, valor: 1350 });
    // inicial + entradas - salidas = final
    expect(k.inicial.valor + k.entradas.valor - k.salidas.valor).toBe(k.final.valor);
    expect(k.diferenciaValuacion).toBe(0);
    expect(k.stockNegativo).toBe(false);
  });

  it('venta sin stock: la diferencia de valuación hace cerrar el kardex', () => {
    const k = kardexValorizado(
      [
        mov('2026-01-01', 'compra', 2, 1, 100),
        mov('2026-01-02', 'venta', 5, -1), // queda en -3, valuadas a 100
        mov('2026-01-03', 'compra', 10, 1, 130), // el promedio pasa a 130: las -3 se revalúan
      ],
      '2026-01-01',
      '2026-01-31',
      null,
    );
    expect(k.stockNegativo).toBe(true);
    expect(k.final).toEqual({ cantidad: 7, costoPromedio: 130, valor: 910 });
    expect(k.diferenciaValuacion).toBe(-90);
    expect(k.inicial.valor + k.entradas.valor - k.salidas.valor + k.diferenciaValuacion).toBe(k.final.valor);
  });

  it('las pérdidas se suman al costo con que se registraron (igual que resultados)', () => {
    const k = kardexValorizado([mov('2026-01-01', 'compra', 4, 1, 100), mov('2026-01-02', 'rotura', 1, -1, 90)], '2026-01-01', '2026-01-31', null);
    expect(k.perdidas).toEqual({ cantidad: 1, valor: 90 });
    expect(k.salidas.valor).toBe(100); // en el kardex sale al promedio
  });

  it('el saldo inicial acumula lo anterior al período', () => {
    const k = kardexValorizado(
      [mov('2025-12-01', 'compra', 5, 1, 80), mov('2025-12-20', 'venta', 1, -1), mov('2026-01-03', 'merma', 2, -1)],
      '2026-01-01',
      '2026-01-31',
      null,
    );
    expect(k.inicial).toEqual({ cantidad: 4, costoPromedio: 80, valor: 320 });
    expect(k.filas).toHaveLength(1);
    expect(k.perdidas).toEqual({ cantidad: 2, valor: 160 });
    expect(k.final.valor).toBe(160);
  });

  it('sin compras con costo usa el costo de respaldo, e ignora traslados', () => {
    const k = kardexValorizado(
      [mov('2026-01-01', 'ajuste_positivo', 3, 1), mov('2026-01-02', 'transferencia', 3, -1), mov('2026-01-03', 'venta', 1, -1)],
      '2026-01-01',
      '2026-01-31',
      50,
    );
    expect(k.filas).toHaveLength(2);
    expect(k.final).toEqual({ cantidad: 2, costoPromedio: 50, valor: 100 });
  });

  it('período sin movimientos: inicial = final', () => {
    const k = kardexValorizado([mov('2025-06-01', 'compra', 2, 1, 10)], '2026-01-01', '2026-01-31', null);
    expect(k.filas).toHaveLength(0);
    expect(k.inicial).toEqual(k.final);
    expect(k.final.valor).toBe(20);
  });
});
