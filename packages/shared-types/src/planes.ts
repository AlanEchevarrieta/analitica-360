/**
 * Catálogo de planes: qué funciones trae cada uno y sus límites (aprobado el
 * 2026-10-04). Lo aplican el PlanGuard (cada endpoint) y AccesoCuentaService
 * (usuarios). La web tiene la misma definición en
 * apps/api/src/modules/planes/planes.util.ts: un test (planes.sincronia.spec.ts)
 * falla si se separan.
 */

export type PlanId = "starter" | "basico" | "pro" | "ecommerce";
export type CicloFacturacion = "mensual" | "trimestral" | "anual";
export type PlanPagoId = "basico" | "pro" | "ecommerce";

/**
 * Funciones que se habilitan por plan. Las que coinciden con un módulo
 * (@RequireModulo) se controlan solas; el resto usa @RequireFuncion.
 * "configuracion" no se limita por plan: siempre se puede configurar.
 */
export type Funcion =
  | "inicio"
  | "productos"
  | "ventas"
  | "clientes"
  | "compras"
  | "proveedores"
  | "inventario"
  | "soporte"
  | "analytics"
  | "insights"
  | "contabilidad"
  | "pedidos"
  | "produccion"
  | "listas_precios"
  | "cuenta_corriente"
  | "difusiones"
  | "importar"
  | "auditoria"
  | "tienda";

export interface PlanDef {
  nombre: string;
  funciones: readonly Funcion[];
  /** null = sin límite. */
  maxUsuarios: number | null;
  maxUbicaciones: number | null;
  maxProductos: number | null;
}

const BASICO: Funcion[] = ["inicio", "productos", "ventas", "clientes", "compras", "proveedores", "inventario", "soporte"];
const PRO: Funcion[] = [...BASICO, "analytics", "insights", "contabilidad", "pedidos", "produccion", "listas_precios", "cuenta_corriente", "difusiones", "importar", "auditoria"];

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: "Starter", funciones: ["inicio", "productos", "ventas", "clientes", "soporte"], maxUsuarios: 1, maxUbicaciones: 1, maxProductos: 100 },
  basico: { nombre: "Básico", funciones: BASICO, maxUsuarios: 2, maxUbicaciones: 2, maxProductos: null },
  pro: { nombre: "Pro", funciones: PRO, maxUsuarios: 10, maxUbicaciones: null, maxProductos: null },
  ecommerce: { nombre: "E-commerce", funciones: [...PRO, "tienda"], maxUsuarios: null, maxUbicaciones: null, maxProductos: null },
};

export const PLAN_DE_PRUEBA: PlanId = "pro";

/** Normaliza nombres históricos: "Básico" -> basico; "Premium" y "business" -> pro. */
export function clavePlan(nombre: string | null | undefined): string {
  const p = (nombre ?? "").trim().toLowerCase();
  if (p === "básico") return "basico";
  if (p === "premium" || p === "business") return "pro";
  return p;
}

export function idPlan(nombre: string | null | undefined): PlanId {
  const p = clavePlan(nombre);
  if (p === "basico" || p === "pro" || p === "ecommerce" || p === "starter") return p;
  return "starter";
}

export function defPlan(plan: string | null | undefined): PlanDef {
  return PLANES[idPlan(plan)];
}

/** Lo que puede usar la empresa: en prueba, lo del Pro; si no, lo de su plan. */
export function planEfectivo(plan: string | null | undefined, enPrueba: boolean): PlanId {
  return enPrueba ? PLAN_DE_PRUEBA : idPlan(plan);
}

/** ¿El plan (o la prueba) incluye esta función? */
export function tieneAcceso(plan: string, funcion: string, enTrial: boolean): boolean {
  return (PLANES[planEfectivo(plan, enTrial)].funciones as readonly string[]).includes(funcion);
}

/** El plan pago más económico que incluye esa función. */
export function planMinimoPara(funcion: string): PlanPagoId {
  for (const id of ["basico", "pro", "ecommerce"] as const) {
    if ((PLANES[id].funciones as readonly string[]).includes(funcion)) return id;
  }
  return "ecommerce";
}
