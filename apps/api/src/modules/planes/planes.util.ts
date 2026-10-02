/**
 * Puerto fiel de src/lib/planes.ts. Solo lo que es dato/lógica de
 * autorización real (qué módulos trae cada plan, precios, normalización de
 * nombre de plan) - lo que es presentación pura (CSS, copy de marketing,
 * labels, link de WhatsApp, mapeo de ruta del router del frontend) queda
 * afuera, mismo criterio que el resto del backend.
 *
 * IMPORTANTE: nada de esto está conectado todavía a los guards existentes
 * (RolesGuard/PermissionsGuard) - ningún módulo ya construido (Analytics,
 * Insights, Contabilidad, etc.) valida el plan contratado hoy, solo
 * rol/módulo dentro de la empresa. Conectar el gating por plan a esos
 * guards es una pasada aparte, deliberadamente fuera de alcance acá (así
 * se decidió explícitamente antes de esta fase).
 */

export type PlanId = 'starter' | 'basico' | 'pro' | 'ecommerce';
export type CicloFacturacion = 'mensual' | 'trimestral' | 'anual';
export type PlanPagoId = 'basico' | 'pro' | 'ecommerce';

export interface PlanDef {
  nombre: string;
  modulos: readonly string[];
  maxUsuarios: number | null;
  maxProductos: number | null;
}

const MODULOS_OPERACION = ['inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte'];
/**
 * Pro (2026-10-02) absorbe al ex Premium y hereda todos sus módulos para que
 * nadie pierda acceso. PENDIENTE: definir los módulos y límites de cada plan.
 */
const MODULOS_PRO = [...MODULOS_OPERACION, 'analytics', 'pedidos', 'produccion', 'insights', 'contabilidad'];

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: 'Starter', modulos: ['inicio', 'productos', 'ventas', 'clientes'], maxUsuarios: 1, maxProductos: 100 },
  basico: { nombre: 'Básico', modulos: MODULOS_OPERACION, maxUsuarios: 2, maxProductos: null },
  pro: { nombre: 'Pro', modulos: MODULOS_PRO, maxUsuarios: null, maxProductos: null },
  ecommerce: { nombre: 'E-commerce', modulos: [...MODULOS_PRO, 'tienda'], maxUsuarios: null, maxProductos: null },
};

export const PLANES_PAGOS: PlanPagoId[] = ['basico', 'pro', 'ecommerce'];

/** Durante la prueba gratis se usan todas las funciones del Pro. */
export const modulosDuranteTrial = PLANES.pro.modulos;

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

/** Durante el trial, los módulos de Pro; fuera de trial, según el plan contratado. */
export function tieneAcceso(plan: string, modulo: string, enTrial: boolean): boolean {
  if (enTrial) return modulosDuranteTrial.includes(modulo);
  return defPlan(plan).modulos.includes(modulo);
}

export function planTieneAnalytics(plan: string | null | undefined, enTrial = false): boolean {
  return tieneAcceso(clavePlan(plan), 'analytics', enTrial);
}

export function planTieneInsights(plan: string | null | undefined, enTrial = false): boolean {
  return tieneAcceso(clavePlan(plan), 'insights', enTrial);
}

/** El plan pago más económico que incluye ese módulo. */
export function planMinimoParaModulo(modulo: string): PlanPagoId {
  for (const id of PLANES_PAGOS) {
    if (PLANES[id].modulos.includes(modulo)) return id;
  }
  return 'pro';
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
