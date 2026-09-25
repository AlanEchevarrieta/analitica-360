import { calcularTotalesCredito, configuracionVentaDesde } from './ventas.util.js';

describe('calcularTotalesCredito', () => {
  it('sin interés (coeficiente 0), el total con interés es igual al total sin interés', () => {
    const r = calcularTotalesCredito(1000, 0, 1);
    expect(r).toEqual({ interes: 0, totalConInteres: 1000, valorCuota: 1000 });
  });

  it('aplica el coeficiente como porcentaje sobre el total sin interés', () => {
    const r = calcularTotalesCredito(1000, 15, 6);
    expect(r.interes).toBe(150);
    expect(r.totalConInteres).toBe(1150);
    expect(r.valorCuota).toBeCloseTo(191.67, 2);
  });

  it('coeficiente negativo se trata como 0', () => {
    const r = calcularTotalesCredito(1000, -10, 1);
    expect(r.interes).toBe(0);
  });

  it('0 cuotas devuelve el total con interés como valor de cuota', () => {
    const r = calcularTotalesCredito(1000, 0, 0);
    expect(r.valorCuota).toBe(1000);
  });
});

describe('configuracionVentaDesde', () => {
  it('traduce mp_qr a qr, descarta medios desconocidos y deja solo cuotas activas ordenadas', () => {
    const config = configuracionVentaDesde(
      ['efectivo', 'mp_qr', 'cheque'],
      [
        { cuotas: 6, tasa: 15, label: '6 cuotas', activo: true },
        { cuotas: 1, tasa: 0, label: '1 cuota', activo: true },
        { cuotas: 18, tasa: 70, label: '18 cuotas', activo: false },
        { cuotas: 0, tasa: 0, label: 'Plan Z', activo: true },
      ],
      ' Stand ',
    );
    expect(config).toEqual({
      mediosPago: ['efectivo', 'qr'],
      cuotas: [
        { cuotas: 1, tasa: 0, etiqueta: '1 cuota' },
        { cuotas: 6, tasa: 15, etiqueta: '6 cuotas' },
      ],
      ubicacionDefault: 'Stand',
    });
  });

  it('sin configuración usa todos los medios y ninguna cuota', () => {
    expect(configuracionVentaDesde(null, null, null)).toEqual({
      mediosPago: ['efectivo', 'transferencia', 'debito', 'credito', 'qr'],
      cuotas: [],
      ubicacionDefault: null,
    });
  });
});
