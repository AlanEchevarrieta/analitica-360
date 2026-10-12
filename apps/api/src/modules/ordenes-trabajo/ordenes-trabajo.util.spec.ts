import { describe, expect, it } from 'vitest';
import { mensajeEtapa, ventaDeEntrega } from './ordenes-trabajo.util.js';

describe('órdenes de trabajo: venta al entregar', () => {
  it('sin seña: venta común', () => {
    expect(ventaDeEntrega(50_000, 0, 'efectivo')).toEqual({ ok: true, formaPago: 'efectivo', esSenia: false, montoSenia: 0, aplicarSenia: 0 });
  });

  it('con seña: lo que paga ahora es la seña de la venta y la seña vieja cubre el saldo', () => {
    expect(ventaDeEntrega(50_000, 20_000, 'transferencia')).toEqual({ ok: true, formaPago: 'transferencia', esSenia: true, montoSenia: 30_000, aplicarSenia: 20_000 });
  });

  it('si queda debiendo, va a cuenta corriente y se aplica la seña', () => {
    expect(ventaDeEntrega(50_000, 20_000, 'cuenta_corriente')).toEqual({ ok: true, formaPago: 'cuenta_corriente', esSenia: false, montoSenia: 0, aplicarSenia: 20_000 });
  });

  it('si la seña cubre todo, no se cobra nada más', () => {
    expect(ventaDeEntrega(20_000, 20_000, 'efectivo')).toMatchObject({ ok: true, formaPago: 'cuenta_corriente', aplicarSenia: 20_000 });
  });

  it('la seña no puede superar el total', () => {
    const r = ventaDeEntrega(15_000, 20_000, 'efectivo');
    expect(r.ok).toBe(false);
  });

  it('el aviso de "listo" dice el total', () => {
    expect(mensajeEtapa({ estado: 'listo', numero: 'OT-000003', equipo: 'notebook Lenovo', cliente: 'Laura Pérez', negocio: 'Service Sur', total: 45_000 })).toBe(
      'Hola Laura! Tu notebook Lenovo (orden OT-000003) ya está listo para retirar. Total: $45.000.\nService Sur',
    );
  });
});
