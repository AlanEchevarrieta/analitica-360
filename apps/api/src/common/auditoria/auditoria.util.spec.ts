import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { accionDeEdicion, aplicarData, AUDITADOS, diferencias, nombreDeFila, resumen } from './auditoria.util.js';

describe('bitácora de auditoría', () => {
  it('detecta solo lo que cambió, con Decimal y fechas comparables', () => {
    const antes = { id: '1', nombre: 'Mochila', precioVenta: new Prisma.Decimal('12200'), costo: new Prisma.Decimal('6000'), updatedAt: new Date('2026-01-01') };
    const despues = { ...antes, precioVenta: new Prisma.Decimal('13000'), updatedAt: new Date('2026-10-03') };
    expect(diferencias(antes, despues)).toEqual({ precioVenta: [12200, 13000] });
  });

  it('nunca guarda el valor de un campo secreto', () => {
    expect(diferencias({ apiToken: 'viejo' }, { apiToken: 'nuevo' })).toEqual({ apiToken: ['•••', '•••'] });
  });

  it('si el resultado no trae un campo (select parcial) no inventa un cambio', () => {
    expect(diferencias({ nombre: 'A', costo: 1 }, { nombre: 'B' })).toEqual({ nombre: ['A', 'B'] });
  });

  it('las relaciones incluidas en el resultado no cuentan como cambio', () => {
    expect(diferencias({ nombre: 'A', categoriaId: null }, { nombre: 'A', categoriaId: 'c1', categoriaRel: { nombre: 'Mochilas' } })).toEqual({ categoriaId: [null, 'c1'] });
  });

  it('al crear, todos los campos van de vacío al valor', () => {
    expect(diferencias(null, { id: 'x', nombre: 'Cliente', telefono: null })).toEqual({ nombre: [null, 'Cliente'] });
  });

  it('aplica increment/decrement de un updateMany e ignora relaciones', () => {
    const fila = { saldoPendiente: new Prisma.Decimal('5000'), estado: 'a' };
    expect(aplicarData(fila, { saldoPendiente: { decrement: 2000 }, estado: 'b', items: { create: [] } })).toEqual({ saldoPendiente: 3000, estado: 'b' });
  });

  it('borrar y restaurar se reconocen por deletedAt', () => {
    expect(accionDeEdicion({ deletedAt: [null, '2026-10-03'] })).toBe('borrar');
    expect(accionDeEdicion({ deletedAt: ['2026-10-03', null] })).toBe('restaurar');
    expect(accionDeEdicion({ nombre: ['a', 'b'] })).toBe('editar');
  });

  it('el resumen se lee como una frase', () => {
    expect(resumen('Producto', 'editar', 'Mochila', { precioVenta: [12200, 13000] })).toBe('editó producto «Mochila»: precio de venta $12.200 → $13.000');
    expect(resumen('Venta', 'crear', 'V-000640', {})).toBe('creó venta «V-000640»');
    expect(resumen('Producto', 'editar', null, { a: [1, 2], b: [1, 2], c: [1, 2], d: [1, 2], e: [1, 2] })).toMatch(/y 2 cambios más$/);
  });

  it('las fechas sin hora se leen como fecha', () => {
    expect(resumen('Producto', 'editar', 'Mate', { ofertaHasta: [null, '2026-10-12T00:00:00.000Z'] })).toBe('editó producto «Mate»: oferta hasta (vacío) → 12/10/2026');
  });

  it('si cambian el texto y su id, la frase muestra solo el texto', () => {
    expect(resumen('Producto', 'editar', 'Mochila', { categoria: [null, 'Mochilas'], categoriaId: [null, 'c1'] })).toBe('editó producto «Mochila»: categoría (vacío) → Mochilas');
  });

  it('solo los movimientos de stock manuales (no los de cada venta)', () => {
    const filtro = AUDITADOS.MovimientoInventario.filtro!;
    expect(filtro({ tipo: 'merma' })).toBe(true);
    expect(filtro({ tipo: 'venta' })).toBe(false);
  });

  it('el nombre de la fila sale del primer campo con valor', () => {
    expect(nombreDeFila('Usuario', { nombre: '', email: 'a@b.c' })).toBe('a@b.c');
    expect(nombreDeFila('Desconocido', { nombre: 'x' })).toBeNull();
  });
});
