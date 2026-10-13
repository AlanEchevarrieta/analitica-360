import { describe, expect, it } from 'vitest';
import { baseDeVenta, liquidar } from './comisiones.util.js';

describe('comisiones', () => {
  it('separa servicios y productos', () => {
    expect(baseDeVenta({ subtotal: 15_000, descuento: 0, items: [{ esServicio: true, importe: 12_000 }, { esServicio: false, importe: 3_000 }] })).toEqual({ servicios: 12000, productos: 3000 });
  });

  it('el descuento de la venta se reparte en proporción', () => {
    expect(baseDeVenta({ subtotal: 20_000, descuento: 2_000, items: [{ esServicio: true, importe: 15_000 }, { esServicio: false, importe: 5_000 }] })).toEqual({ servicios: 13500, productos: 4500 });
  });

  it('lo devuelto resta', () => {
    expect(baseDeVenta({ subtotal: 10_000, descuento: 0, items: [{ esServicio: false, importe: 10_000 }, { esServicio: false, importe: -4_000 }] })).toEqual({ servicios: 0, productos: 6000 });
  });

  it('liquida con los porcentajes y el fijo por sesión', () => {
    const ventas = [
      { subtotal: 12_000, descuento: 0, items: [{ esServicio: true, importe: 12_000 }] },
      { subtotal: 18_000, descuento: 0, items: [{ esServicio: true, importe: 10_000 }, { esServicio: false, importe: 8_000 }] },
    ];
    expect(liquidar(ventas, 3, { servicios: 40, productos: 10, porSesion: 1_500 })).toEqual({
      baseServicios: 22000,
      baseProductos: 8000,
      sesiones: 3,
      porServicios: 8800,
      porProductos: 800,
      porSesiones: 4500,
      total: 14100,
    });
  });
});
