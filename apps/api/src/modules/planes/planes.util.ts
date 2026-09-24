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

export type PlanId = 'starter' | 'basico' | 'pro' | 'premium' | 'ecommerce';
export type CicloFacturacion = 'mensual' | 'anual';
export type PlanPagoId = 'basico' | 'pro' | 'premium' | 'ecommerce';

export interface PlanDef {
  nombre: string;
  modulos: readonly string[];
  maxUsuarios: number | null;
  maxProductos: number | null;
}

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: 'Starter', modulos: ['inicio', 'productos', 'ventas', 'clientes'], maxUsuarios: 1, maxProductos: 100 },
  basico: {
    nombre: 'Básico',
    modulos: ['inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte'],
    maxUsuarios: 2,
    maxProductos: null,
  },
  pro: {
    nombre: 'Pro',
    modulos: ['inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte', 'analytics', 'pedidos'],
    maxUsuarios: 5,
    maxProductos: null,
  },
  premium: {
    nombre: 'Premium',
    modulos: [
      'inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte',
      'analytics', 'pedidos', 'insights', 'contabilidad',
    ],
    maxUsuarios: null,
    maxProductos: null,
  },
  ecommerce: {
    nombre: 'E-commerce',
    modulos: [
      'inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte',
      'analytics', 'pedidos', 'insights', 'contabilidad', 'tienda',
    ],
    maxUsuarios: null,
    maxProductos: null,
  },
};

export const PLANES_PAGOS: PlanPagoId[] = ['basico', 'pro', 'premium', 'ecommerce'];

export const modulosDuranteTrial = PLANES.premium.modulos;

/** Puerto de clavePlan: normaliza variantes históricas del nombre de plan. */
export function clavePlan(nombre: string | null | undefined): string {
  const p = (nombre ?? '').trim().toLowerCase();
  if (p === 'básico') return 'basico';
  if (p === 'business') return 'premium';
  return p;
}

/** Puerto de idPlan: clavePlan() acotado a un PlanId válido, 'starter' si no matchea ninguno. */
export function idPlan(nombre: string | null | undefined): PlanId {
  const p = clavePlan(nombre);
  if (p === 'basico' || p === 'pro' || p === 'premium' || p === 'ecommerce' || p === 'starter') return p;
  return 'starter';
}

/** Puerto de defPlan. */
export function defPlan(plan: string | null | undefined): PlanDef {
  return PLANES[idPlan(plan)];
}

/** Puerto de tieneAcceso: durante el trial, siempre los módulos de Premium (modulosDuranteTrial), fuera de trial según el plan contratado. */
export function tieneAcceso(plan: string, modulo: string, enTrial: boolean): boolean {
  if (enTrial) return modulosDuranteTrial.includes(modulo);
  return defPlan(plan).modulos.includes(modulo);
}

/** Puerto de planTieneAnalytics. */
export function planTieneAnalytics(plan: string | null | undefined, enTrial = false): boolean {
  return tieneAcceso(clavePlan(plan), 'analytics', enTrial);
}

/** Puerto de planTieneInsights. */
export function planTieneInsights(plan: string | null | undefined, enTrial = false): boolean {
  return tieneAcceso(clavePlan(plan), 'insights', enTrial);
}

/** Puerto de planMinimoParaModulo: el plan pago más económico que incluye ese módulo. */
export function planMinimoParaModulo(modulo: string): PlanPagoId {
  for (const id of PLANES_PAGOS) {
    if (PLANES[id].modulos.includes(modulo)) return id;
  }
  return 'premium';
}

/** Puerto de planEsIlimitado. */
export function planEsIlimitado(plan: string | null | undefined): boolean {
  const id = idPlan(plan);
  return id === 'premium' || id === 'ecommerce';
}

export const PRECIOS: Record<PlanPagoId, { mensual: number; anual: number }> = {
  basico: { mensual: 25_000, anual: 20_000 },
  pro: { mensual: 70_000, anual: 56_000 },
  premium: { mensual: 95_000, anual: 76_000 },
  ecommerce: { mensual: 150_000, anual: 120_000 },
};

export const DESCUENTO_LANZAMIENTO = 0.4;
export const DESCUENTO_ANUAL = 0.2;
export const MESES_DESCUENTO_LANZAMIENTO = 3;

/** Puerto de precioLista. */
export function precioLista(plan: PlanPagoId, ciclo: CicloFacturacion): number {
  return PRECIOS[plan][ciclo];
}

/** Puerto de precioLanzamiento. */
export function precioLanzamiento(plan: PlanPagoId, ciclo: CicloFacturacion): number {
  return Math.round(precioLista(plan, ciclo) * (1 - DESCUENTO_LANZAMIENTO));
}

/** Puerto de desgloseAnualPlan: precio mes a mes de un plan anual con descuento de lanzamiento los primeros 3 meses. */
export function desgloseAnualPlan(plan: PlanPagoId): { listaMes: number; mes1a3: number; mes4a12: number; totalAnio: number } {
  const listaMes = PRECIOS[plan].mensual;
  const mes1a3 = Math.round(listaMes * (1 - DESCUENTO_LANZAMIENTO));
  const mes4a12 = Math.round(listaMes * (1 - DESCUENTO_ANUAL));
  return { listaMes, mes1a3, mes4a12, totalAnio: mes1a3 * 3 + mes4a12 * 9 };
}

/** Puerto de mesesAhorroAnual. */
export function mesesAhorroAnual(): number {
  return Math.round(DESCUENTO_ANUAL * 12);
}

/** Puerto de ORDEN_PLANES + ordenarPlanesAdmin: orden fijo para listados admin (starter -> ... -> ecommerce/business). */
export const ORDEN_PLANES = ['starter', 'basico', 'básico', 'pro', 'premium', 'ecommerce', 'business'] as const;

export function ordenarPlanesAdmin<T extends { nombre: string }>(planes: T[]): T[] {
  return [...planes].sort((a, b) => {
    const ia = ORDEN_PLANES.indexOf(a.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number]);
    const ib = ORDEN_PLANES.indexOf(b.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}
