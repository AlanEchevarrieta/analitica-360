import {
  clavePlan,
  defPlan,
  desgloseAnualPlan,
  idPlan,
  mesesAhorroAnual,
  ordenarPlanesAdmin,
  planEsIlimitado,
  planMinimoParaModulo,
  planTieneAnalytics,
  planTieneInsights,
  precioLanzamiento,
  precioLista,
  tieneAcceso,
} from './planes.util.js';

describe('clavePlan / idPlan / defPlan', () => {
  it('normaliza variantes históricas', () => {
    expect(clavePlan('Básico')).toBe('basico');
    expect(clavePlan('Business')).toBe('premium');
    expect(idPlan('business')).toBe('premium');
  });

  it('un plan desconocido cae a starter', () => {
    expect(idPlan('inventado')).toBe('starter');
    expect(idPlan(null)).toBe('starter');
  });

  it('defPlan devuelve la definición completa', () => {
    expect(defPlan('pro').nombre).toBe('Pro');
    expect(defPlan('pro').modulos).toContain('analytics');
  });
});

describe('tieneAcceso', () => {
  it('durante el trial siempre da acceso a los módulos de Premium, sin importar el plan', () => {
    expect(tieneAcceso('starter', 'contabilidad', true)).toBe(true);
    expect(tieneAcceso('starter', 'tienda', true)).toBe(false); // tienda es solo de ecommerce, ni Premium la tiene
  });

  it('fuera de trial depende del plan contratado', () => {
    expect(tieneAcceso('starter', 'analytics', false)).toBe(false);
    expect(tieneAcceso('pro', 'analytics', false)).toBe(true);
  });
});

describe('planTieneAnalytics / planTieneInsights', () => {
  it('analytics desde Pro, insights recién desde Premium', () => {
    expect(planTieneAnalytics('pro')).toBe(true);
    expect(planTieneInsights('pro')).toBe(false);
    expect(planTieneInsights('premium')).toBe(true);
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
  it('solo premium y ecommerce son ilimitados', () => {
    expect(planEsIlimitado('premium')).toBe(true);
    expect(planEsIlimitado('ecommerce')).toBe(true);
    expect(planEsIlimitado('pro')).toBe(false);
  });
});

describe('precios', () => {
  it('precioLanzamiento aplica el 40% de descuento', () => {
    expect(precioLista('pro', 'mensual')).toBe(70_000);
    expect(precioLanzamiento('pro', 'mensual')).toBe(42_000);
  });

  it('desgloseAnualPlan combina descuento de lanzamiento (3 meses) y anual (9 meses)', () => {
    const d = desgloseAnualPlan('basico');
    expect(d.listaMes).toBe(25_000);
    expect(d.mes1a3).toBe(15_000); // 25000 * 0.6
    expect(d.mes4a12).toBe(20_000); // 25000 * 0.8
    expect(d.totalAnio).toBe(15_000 * 3 + 20_000 * 9);
  });

  it('mesesAhorroAnual son ~2.4 meses redondeado', () => {
    expect(mesesAhorroAnual()).toBe(2);
  });
});

describe('ordenarPlanesAdmin', () => {
  it('ordena según ORDEN_PLANES, planes desconocidos al final', () => {
    const planes = [{ nombre: 'Premium' }, { nombre: 'starter' }, { nombre: 'Desconocido' }, { nombre: 'pro' }];
    expect(ordenarPlanesAdmin(planes).map((p) => p.nombre)).toEqual(['starter', 'pro', 'Premium', 'Desconocido']);
  });
});
