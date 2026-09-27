import { asientos, mayor, nombreCuenta, type DatosDiario } from './libro-diario.util.js';

const vacio: DatosDiario = { ventas: [], cobros: [], devoluciones: [], compras: [], gastos: [], movimientos: [], perdidas: [], amortizaciones: [] };

describe('libro diario', () => {
  const datos: DatosDiario = {
    ...vacio,
    movimientos: [
      { fecha: '2026-09-01', tipo: 'aporte', monto: 100_000, conCaja: true, descripcion: null },
      { fecha: '2026-09-02', tipo: 'bien_uso', monto: 12_000, conCaja: true, descripcion: 'Notebook' },
      { fecha: '2026-09-20', tipo: 'pago_proveedor', monto: 20_000, conCaja: true, descripcion: null },
    ],
    compras: [
      { fecha: '2026-09-05', monto: 40_000, aCredito: false, proveedor: 'El Tío' },
      { fecha: '2026-09-05', monto: 20_000, aCredito: true, proveedor: 'Calabazas SA' },
    ],
    // 50.000 vendidos (35.000 cobrados, 15.000 a cuenta) que costaron 30.000.
    ventas: [{ fecha: '2026-09-10', cantidad: 4, total: 50_000, cobrado: 35_000, costo: 30_000 }],
    cobros: [{ fecha: '2026-09-15', monto: 10_000, detalle: 'Juana' }],
    devoluciones: [{ fecha: '2026-09-12', ingreso: -5_000, costo: -3_000 }],
    gastos: [{ fecha: '2026-09-15', monto: 5_000, categoria: 'alquiler', descripcion: null }],
    perdidas: [{ fecha: '2026-09-18', monto: 1_500 }],
    amortizaciones: [{ fecha: '2026-09-30', monto: 1_000 }],
  };

  it('cada asiento cierra: debe = haber', () => {
    for (const a of asientos(datos)) {
      const debe = a.lineas.reduce((s, l) => s + l.debe, 0);
      const haber = a.lineas.reduce((s, l) => s + l.haber, 0);
      expect(Math.abs(debe - haber)).toBeLessThan(0.001);
    }
  });

  it('venta del día: caja + deudores contra ventas, y costo contra mercaderías', () => {
    const v = asientos(datos).find((a) => a.origen === 'venta')!;
    expect(v.concepto).toBe('Ventas del 10/09/2026 (4 ventas)');
    expect(v.lineas).toEqual([
      { cuenta: 'caja', debe: 35_000, haber: 0 },
      { cuenta: 'deudores', debe: 15_000, haber: 0 },
      { cuenta: 'ventas', debe: 0, haber: 50_000 },
      { cuenta: 'cmv', debe: 30_000, haber: 0 },
      { cuenta: 'mercaderias', debe: 0, haber: 30_000 },
    ]);
  });

  it('ordenado por fecha y una compra a crédito va a proveedores', () => {
    const lista = asientos(datos);
    expect(lista.map((a) => a.fecha)).toEqual([...lista.map((a) => a.fecha)].sort());
    expect(lista.find((a) => a.concepto.includes('Calabazas'))!.lineas[1]).toEqual({ cuenta: 'proveedores', debe: 0, haber: 20_000 });
  });

  it('mayor: saldos por cuenta que cierran con el balance', () => {
    const m = mayor(asientos(datos));
    const saldo = (c: string) => m.find((x) => x.cuenta === c)?.saldo ?? 0;
    // Caja: +100.000 aporte -12.000 notebook -40.000 compra +35.000 ventas -5.000 devolución +10.000 cobro -5.000 gasto -20.000 proveedor
    expect(saldo('caja')).toBe(63_000);
    expect(saldo('deudores')).toBe(5_000);
    expect(saldo('mercaderias')).toBe(60_000 - 30_000 + 3_000 - 1_500);
    expect(saldo('proveedores')).toBe(0);
    expect(saldo('ventas')).toBe(-50_000);
    expect(m.reduce((s, x) => s + x.saldo, 0)).toBeCloseTo(0, 5);
    expect(nombreCuenta('gastos:alquiler', { alquiler: 'Alquiler' })).toBe('Gastos de alquiler');
  });

  it('período sin operaciones: sin asientos', () => {
    expect(asientos(vacio)).toEqual([]);
    expect(mayor([])).toEqual([]);
  });
});
