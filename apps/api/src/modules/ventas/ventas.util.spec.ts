import { calcularTotalesCredito } from './ventas.util.js';

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
