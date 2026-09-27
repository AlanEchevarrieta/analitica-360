import { aplicarCobro, diasEntre, estadoDeCuenta, mensajeRecordatorio, tramo } from './cuenta-corriente.util.js';

describe('cuenta corriente', () => {
  const pendientes = [
    { ventaId: 'v2', fecha: '2026-09-10', saldo: 30000 },
    { ventaId: 'v1', fecha: '2026-08-01', saldo: 20000 },
    { ventaId: 'v3', fecha: '2026-09-20', saldo: 15000 },
  ];

  it('un cobro se aplica a las ventas más viejas primero', () => {
    expect(aplicarCobro(pendientes, 35000)).toEqual([
      { ventaId: 'v1', monto: 20000 },
      { ventaId: 'v2', monto: 15000 },
    ]);
    expect(aplicarCobro(pendientes, 65000)).toHaveLength(3);
  });

  it('no se puede cobrar más de lo que debe, ni cero', () => {
    expect(aplicarCobro(pendientes, 65000.01)).toBeNull();
    expect(aplicarCobro(pendientes, 0)).toBeNull();
    expect(aplicarCobro([], 100)).toBeNull();
  });

  it('antigüedad de la deuda', () => {
    expect(tramo(0)).toBe('al_dia');
    expect(tramo(30)).toBe('al_dia');
    expect(tramo(31)).toBe('mas_30');
    expect(tramo(75)).toBe('mas_60');
    expect(tramo(120)).toBe('mas_90');
    expect(diasEntre('2026-08-01', '2026-09-26')).toBe(56);
  });

  it('resumen de cuenta con saldo acumulado', () => {
    const e = estadoDeCuenta([
      { fecha: '2026-09-10', concepto: 'Cobro', debe: 0, haber: 25000 },
      { fecha: '2026-08-01', concepto: 'Venta V-1', debe: 20000, haber: 0 },
      { fecha: '2026-09-10', concepto: 'Venta V-2', debe: 30000, haber: 0 },
    ]);
    expect(e.map((l) => [l.concepto, l.saldo])).toEqual([
      ['Venta V-1', 20000],
      ['Venta V-2', 50000],
      ['Cobro', 25000],
    ]);
  });

  it('mensaje de recordatorio', () => {
    expect(mensajeRecordatorio('Juana Pérez', 'Acacia', 25000)).toContain('Hola Juana! Te escribimos de Acacia');
    expect(mensajeRecordatorio('Juana Pérez', 'Acacia', 25000)).toMatch(/25\.000/);
  });
});
