/**
 * Catálogo de planes - fuente compartida entre apps/api
 * (modules/planes/planes.util.ts) y apps/web (nav, gating de UI). Puerto
 * fiel de src/lib/planes.ts (legacy). Sin dependencia de zod - son datos y
 * funciones puras.
 *
 * TODO: apps/api todavía tiene su propia copia idéntica en
 * modules/planes/planes.util.ts (no se migró a este paquete compartido
 * para no tocar un módulo ya construido y testeado fuera de la tarea que
 * originó este archivo - el sidebar de Fase 5). Si se edita el catálogo,
 * hay que actualizar los dos lugares hasta que se unifiquen.
 */

export type PlanId = "starter" | "basico" | "pro" | "ecommerce";
export type PlanPagoId = "basico" | "pro" | "ecommerce";

export interface PlanDef {
  nombre: string;
  modulos: readonly string[];
  maxUsuarios: number | null;
  maxProductos: number | null;
}

const OPERACION = ["inicio", "productos", "ventas", "clientes", "compras", "proveedores", "inventario", "soporte"];
/** Pro (2026-10-02) absorbe al ex Premium. PENDIENTE: definir módulos y límites de cada plan. */
const PRO = [...OPERACION, "analytics", "pedidos", "produccion", "insights", "contabilidad"];

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: "Starter", modulos: ["inicio", "productos", "ventas", "clientes"], maxUsuarios: 1, maxProductos: 100 },
  basico: { nombre: "Básico", modulos: OPERACION, maxUsuarios: 2, maxProductos: null },
  pro: { nombre: "Pro", modulos: PRO, maxUsuarios: null, maxProductos: null },
  ecommerce: { nombre: "E-commerce", modulos: [...PRO, "tienda"], maxUsuarios: null, maxProductos: null },
};

export const modulosDuranteTrial = PLANES.pro.modulos;

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

/** Durante el trial, siempre los módulos de Pro; fuera de trial, según el plan contratado. */
export function tieneAcceso(plan: string, modulo: string, enTrial: boolean): boolean {
  if (enTrial) return modulosDuranteTrial.includes(modulo);
  return defPlan(plan).modulos.includes(modulo);
}
