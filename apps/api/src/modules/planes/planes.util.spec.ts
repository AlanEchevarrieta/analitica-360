import {
  clavePlan,
  defPlan,
  esPlanPago,
  idPlan,
  ordenarPlanesAdmin,
  planEsIlimitado,
  planMinimoParaModulo,
  planTieneAnalytics,
  planTieneInsights,
  precioLista,
  tieneAcceso,
} from './planes.util.js';

describe('clavePlan / idPlan / defPlan', () => {
  it('normaliza variantes históricas: Premium y business pasaron a Pro', () => {
    expect(clavePlan('Básico')).toBe('basico');
    expect(clavePlan('Premium')).toBe('pro');
    expect(clavePlan('Business')).toBe('pro');
    expect(idPlan('premium')).toBe('pro');
  });

  it('un plan desconocido cae a starter', () => {
    expect(idPlan('inventado')).toBe('starter');
    expect(idPlan(null)).toBe('starter');
  });

  it('defPlan devuelve la definición completa; Pro hereda los módulos del ex Premium', () => {
    expect(defPlan('pro').nombre).toBe('Pro');
    expect(defPlan('pro').modulos).toEqual(expect.arrayContaining(['analytics', 'insights', 'contabilidad', 'produccion']));
    expect(defPlan('premium').nombre).toBe('Pro');
  });

  it('solo Básico, Pro y E-commerce son planes pagos', () => {
    expect(esPlanPago('basico')).toBe(true);
    expect(esPlanPago('Premium')).toBe(true);
    expect(esPlanPago('starter')).toBe(false);
  });
});

describe('tieneAcceso', () => {
  it('durante el trial da acceso a los módulos de Pro, sin importar el plan', () => {
    expect(tieneAcceso('starter', 'contabilidad', true)).toBe(true);
    expect(tieneAcceso('starter', 'tienda', true)).toBe(false); // tienda es solo de E-commerce
  });

  it('fuera de trial depende del plan contratado', () => {
    expect(tieneAcceso('starter', 'analytics', false)).toBe(false);
    expect(tieneAcceso('pro', 'analytics', false)).toBe(true);
    expect(tieneAcceso('basico', 'analytics', false)).toBe(false);
  });

  it('analytics e insights desde Pro', () => {
    expect(planTieneAnalytics('pro')).toBe(true);
    expect(planTieneInsights('pro')).toBe(true);
    expect(planTieneInsights('basico')).toBe(false);
  });
});

describe('planMinimoParaModulo', () => {
  it('devuelve el plan pago más económico que incluye el módulo', () => {
    expect(planMinimoParaModulo('inventario')).toBe('basico');
    expect(planMinimoParaModulo('analytics')).toBe('pro');
    expect(planMinimoParaModulo('tienda')).toBe('ecommerce');
  });
});

describe('planEsIlimitado', () => {
  it('Pro y E-commerce son ilimitados', () => {
    expect(planEsIlimitado('pro')).toBe(true);
    expect(planEsIlimitado('ecommerce')).toBe(true);
    expect(planEsIlimitado('basico')).toBe(false);
  });
});

describe('precioLista', () => {
  it('lista 2026-10-02: Básico 49.000, Pro 89.000, E-commerce 149.000 por mes; trimestral 3× y anual 12×', () => {
    expect(precioLista('basico', 'mensual')).toBe(49_000);
    expect(precioLista('pro', 'mensual')).toBe(89_000);
    expect(precioLista('ecommerce', 'mensual')).toBe(149_000);
    expect(precioLista('basico', 'trimestral')).toBe(147_000);
    expect(precioLista('basico', 'anual')).toBe(588_000);
  });
});

describe('ordenarPlanesAdmin', () => {
  it('ordena según ORDEN_PLANES, planes desconocidos al final', () => {
    const planes = [{ nombre: 'Premium' }, { nombre: 'starter' }, { nombre: 'Desconocido' }, { nombre: 'pro' }];
    expect(ordenarPlanesAdmin(planes).map((p) => p.nombre)).toEqual(['starter', 'pro', 'Premium', 'Desconocido']);
  });
});
