import { describe, expect, it } from 'vitest';
import * as compartido from '../../../../../packages/shared-types/src/modulos.js';
import {
  MODULOS_CATALOGO,
  MODULO_IDS,
  aplicarDependenciasModulos,
  calcularModulosEfectivos,
  sugerirModulosPorActividades,
} from './modulos.util.js';

describe('modulos.util', () => {
  it('mantiene sincronizado el catálogo entre API y shared-types', () => {
    expect(compartido.MODULOS_CATALOGO).toEqual(MODULOS_CATALOGO);
    expect(compartido.MODULO_IDS).toEqual(MODULO_IDS);
  });

  it('sugiere módulos según actividades del negocio', () => {
    const servicios = sugerirModulosPorActividades(['servicios']);
    expect(servicios.agenda).toBe(true);
    expect(servicios.abonos).toBe(true);
    expect(servicios.ordenes_trabajo).toBe(true);
    expect(servicios.proyectos).toBe(true);
    expect(servicios.produccion).toBe(false);
    expect(servicios.compras).toBe(false);
    expect(servicios.inventario).toBe(false);
  });

  it('permite apagar Inventario sin afectar el resto y recuperarlo después', () => {
    const efectivos = calcularModulosEfectivos(['productos', 'produccion'], { inventario: false });
    expect(efectivos.inventario).toBe(false);
    expect(efectivos.compras).toBe(true);
  });

  it('prende automáticamente Agenda al prender Comisiones si estaba apagada', () => {
    const res = aplicarDependenciasModulos(['productos'], { agenda: false }, { comisiones: true });
    expect(res.modulos.comisiones).toBe(true);
    expect(res.modulos.agenda).toBe(true);
    expect(res.modulosEfectivos.agenda).toBe(true);
    expect(res.prendidosPorDependencia).toContain('agenda');
  });

  it('prende Inventario al prender Producción o Pedidos', () => {
    const res = aplicarDependenciasModulos(['servicios'], {}, { produccion: true });
    expect(res.modulos.inventario).toBe(true);
    expect(res.prendidosPorDependencia).toContain('inventario');
  });
});
