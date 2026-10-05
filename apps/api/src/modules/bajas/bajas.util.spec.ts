import { describe, expect, it } from 'vitest';
import { mismoNombre, ordenDeBorrado, sumarDias, TABLAS_QUE_SE_CONSERVAN } from './bajas.util.js';

const dep = (hija: string, madre: string) => ({ hija, columna: `${madre}_id`, madre, columnaMadre: 'id' });

describe('baja de cuentas', () => {
  it('borra primero las tablas que referencian a otras', () => {
    const orden = ordenDeBorrado(['productos', 'ventas', 'ventas_items', 'clientes'], [dep('ventas_items', 'ventas'), dep('ventas_items', 'productos'), dep('ventas', 'clientes')]);
    expect(orden.indexOf('ventas_items')).toBeLessThan(orden.indexOf('ventas'));
    expect(orden.indexOf('ventas_items')).toBeLessThan(orden.indexOf('productos'));
    expect(orden.indexOf('ventas')).toBeLessThan(orden.indexOf('clientes'));
  });

  it('una tabla que se referencia a sí misma no traba; un ciclo real, sí avisa', () => {
    expect(ordenDeBorrado(['categorias'], [dep('categorias', 'categorias')])).toEqual(['categorias']);
    expect(() => ordenDeBorrado(['a', 'b'], [dep('a', 'b'), dep('b', 'a')])).toThrow(/ciclo/);
  });

  it('las referencias a tablas que no se borran no cuentan', () => {
    expect(ordenDeBorrado(['productos'], [dep('pagos', 'productos'), dep('productos', 'empresas')])).toEqual(['productos']);
  });

  it('se conservan los cobros, la suscripción y la bitácora', () => {
    for (const t of ['pagos', 'cuotas_programadas', 'comisiones', 'suscripciones', 'registro_auditoria']) expect(TABLAS_QUE_SE_CONSERVAN.has(t)).toBe(true);
    for (const t of ['productos', 'clientes', 'ventas', 'usuarios']) expect(TABLAS_QUE_SE_CONSERVAN.has(t)).toBe(false);
  });

  it('confirmar con el nombre: sin importar mayúsculas, tildes ni espacios; vacío no vale', () => {
    expect(mismoNombre('  almacen  ÑANDÚ ', 'Almacén Ñandú')).toBe(true);
    expect(mismoNombre('Almacén', 'Almacén Ñandú')).toBe(false);
    expect(mismoNombre('', '')).toBe(false);
  });

  it('30 días para arrepentirse', () => {
    expect(sumarDias('2026-10-05', 30)).toBe('2026-11-04');
  });
});
