/**
 * Catálogo de planes: qué funciones trae cada uno y sus límites (aprobado el
 * 2026-10-04). Lo aplican el PlanGuard (cada endpoint) y AccesoCuentaService
 * (usuarios). La web tiene la misma definición en
 * packages/shared-types/src/planes.ts: un test (planes.sincronia.spec.ts)
 * falla si se separan.
 */

export type PlanId = 'starter' | 'basico' | 'pro' | 'ecommerce';
export type CicloFacturacion = 'mensual' | 'trimestral' | 'anual';
export type PlanPagoId = 'basico' | 'pro' | 'ecommerce';

/**
 * Funciones que se habilitan por plan. Las que coinciden con un módulo
 * (@RequireModulo) se controlan solas; el resto usa @RequireFuncion.
 * 'configuracion' no se limita por plan: siempre se puede configurar.
 */
export type Funcion =
  | 'inicio'
  | 'productos'
  | 'ventas'
  | 'clientes'
  | 'compras'
  | 'proveedores'
  | 'inventario'
  | 'soporte'
  | 'analytics'
  | 'insights'
  | 'contabilidad'
  | 'pedidos'
  | 'produccion'
  | 'listas_precios'
  | 'cuenta_corriente'
  | 'difusiones'
  | 'importar'
  | 'auditoria'
  | 'tienda';

export interface PlanDef {
  nombre: string;
  funciones: readonly Funcion[];
  /** null = sin límite. */
  maxUsuarios: number | null;
  maxUbicaciones: number | null;
  maxProductos: number | null;
}

const BASICO: Funcion[] = ['inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte'];
const PRO: Funcion[] = [...BASICO, 'analytics', 'insights', 'contabilidad', 'pedidos', 'produccion', 'listas_precios', 'cuenta_corriente', 'difusiones', 'importar', 'auditoria'];

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: 'Starter', funciones: ['inicio', 'productos', 'ventas', 'clientes', 'soporte'], maxUsuarios: 1, maxUbicaciones: 1, maxProductos: 100 },
  basico: { nombre: 'Básico', funciones: BASICO, maxUsuarios: 2, maxUbicaciones: 2, maxProductos: null },
  pro: { nombre: 'Pro', funciones: PRO, maxUsuarios: 10, maxUbicaciones: null, maxProductos: null },
  ecommerce: { nombre: 'E-commerce', funciones: [...PRO, 'tienda'], maxUsuarios: null, maxUbicaciones: null, maxProductos: null },
};

export const PLANES_PAGOS: PlanPagoId[] = ['basico', 'pro', 'ecommerce'];

/** Durante la prueba gratis se usan todas las funciones del Pro (decisión 2026-10-04: la tienda no entra en la prueba). */
export const PLAN_DE_PRUEBA: PlanId = 'pro';

/** Lo que puede usar la empresa: en prueba, lo del Pro; si no, lo de su plan. */
export function planEfectivo(plan: string | null | undefined, enPrueba: boolean): PlanId {
  return enPrueba ? PLAN_DE_PRUEBA : idPlan(plan);
}

/** Normaliza nombres históricos: "Básico" → basico; "Premium" y "business" (nombre viejo de Premium) → pro. */
export function clavePlan(nombre: string | null | undefined): string {
  const p = (nombre ?? '').trim().toLowerCase();
  if (p === 'básico') return 'basico';
  if (p === 'premium' || p === 'business') return 'pro';
  return p;
}

/** clavePlan() acotado a un PlanId válido, 'starter' si no matchea ninguno. */
export function idPlan(nombre: string | null | undefined): PlanId {
  const p = clavePlan(nombre);
  if (p === 'basico' || p === 'pro' || p === 'ecommerce' || p === 'starter') return p;
  return 'starter';
}

export function esPlanPago(nombre: string | null | undefined): nombre is PlanPagoId {
  return PLANES_PAGOS.includes(clavePlan(nombre) as PlanPagoId);
}

/** Puerto de defPlan. */
export function defPlan(plan: string | null | undefined): PlanDef {
  return PLANES[idPlan(plan)];
}

/** ¿El plan (o la prueba) incluye esta función? */
export function tieneAcceso(plan: string, funcion: string, enTrial: boolean): boolean {
  return (PLANES[planEfectivo(plan, enTrial)].funciones as readonly string[]).includes(funcion);
}

export function planTieneAnalytics(plan: string | null | undefined, enTrial = false): boolean {
  return tieneAcceso(clavePlan(plan), 'analytics', enTrial);
}

export function planTieneInsights(plan: string | null | undefined, enTrial = false): boolean {
  return tieneAcceso(clavePlan(plan), 'insights', enTrial);
}

/** El plan pago más económico que incluye esa función. */
export function planMinimoParaModulo(funcion: string): PlanPagoId {
  for (const id of PLANES_PAGOS) {
    if ((PLANES[id].funciones as readonly string[]).includes(funcion)) return id;
  }
  return 'ecommerce';
}

export function planEsIlimitado(plan: string | null | undefined): boolean {
  const id = idPlan(plan);
  return id === 'pro' || id === 'ecommerce';
}

/**
 * Precio de LISTA por mes, en pesos y sin IVA (2026-10-02). Sin promociones al
 * público: los descuentos vienen solo de cupones (ver modules/alianzas).
 */
export const PRECIO_MENSUAL: Record<PlanPagoId, number> = {
  basico: 49_000,
  pro: 89_000,
  ecommerce: 149_000,
};

export const MESES_CICLO: Record<CicloFacturacion, number> = { mensual: 1, trimestral: 3, anual: 12 };
export const CICLOS: CicloFacturacion[] = ['mensual', 'trimestral', 'anual'];

/** Precio de lista de un período completo del ciclo: trimestral = 3 × mensual, anual = 12 × mensual. */
export function precioLista(plan: PlanPagoId, ciclo: CicloFacturacion): number {
  return PRECIO_MENSUAL[plan] * MESES_CICLO[ciclo];
}

/** Puerto de ORDEN_PLANES + ordenarPlanesAdmin: orden fijo para listados admin (starter -> ... -> ecommerce/business). */
export const ORDEN_PLANES = ['starter', 'basico', 'básico', 'pro', 'premium', 'business', 'ecommerce'] as const;

export function ordenarPlanesAdmin<T extends { nombre: string }>(planes: T[]): T[] {
  return [...planes].sort((a, b) => {
    const ia = ORDEN_PLANES.indexOf(a.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number]);
    const ib = ORDEN_PLANES.indexOf(b.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}
