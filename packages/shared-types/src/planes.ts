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

export type PlanId = "starter" | "basico" | "pro" | "premium" | "ecommerce";
export type PlanPagoId = "basico" | "pro" | "premium" | "ecommerce";

export interface PlanDef {
  nombre: string;
  modulos: readonly string[];
  maxUsuarios: number | null;
  maxProductos: number | null;
}

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: "Starter", modulos: ["inicio", "productos", "ventas", "clientes"], maxUsuarios: 1, maxProductos: 100 },
  basico: {
    nombre: "Básico",
    modulos: ["inicio", "productos", "ventas", "clientes", "compras", "proveedores", "inventario", "soporte"],
    maxUsuarios: 2,
    maxProductos: null,
  },
  pro: {
    nombre: "Pro",
    modulos: ["inicio", "productos", "ventas", "clientes", "compras", "proveedores", "inventario", "soporte", "analytics", "pedidos"],
    maxUsuarios: 5,
    maxProductos: null,
  },
  premium: {
    nombre: "Premium",
    modulos: [
      "inicio", "productos", "ventas", "clientes", "compras", "proveedores", "inventario", "soporte",
      "analytics", "pedidos", "insights", "contabilidad",
    ],
    maxUsuarios: null,
    maxProductos: null,
  },
  ecommerce: {
    nombre: "E-commerce",
    modulos: [
      "inicio", "productos", "ventas", "clientes", "compras", "proveedores", "inventario", "soporte",
      "analytics", "pedidos", "insights", "contabilidad", "tienda",
    ],
    maxUsuarios: null,
    maxProductos: null,
  },
};

export const modulosDuranteTrial = PLANES.premium.modulos;

/** Normaliza variantes históricas del nombre de plan ("Básico" -> "basico", "business" -> "premium"). */
export function clavePlan(nombre: string | null | undefined): string {
  const p = (nombre ?? "").trim().toLowerCase();
  if (p === "básico") return "basico";
  if (p === "business") return "premium";
  return p;
}

export function idPlan(nombre: string | null | undefined): PlanId {
  const p = clavePlan(nombre);
  if (p === "basico" || p === "pro" || p === "premium" || p === "ecommerce" || p === "starter") return p;
  return "starter";
}

export function defPlan(plan: string | null | undefined): PlanDef {
  return PLANES[idPlan(plan)];
}

/** Durante el trial, siempre los módulos de Premium; fuera de trial, según el plan contratado. */
export function tieneAcceso(plan: string, modulo: string, enTrial: boolean): boolean {
  if (enTrial) return modulosDuranteTrial.includes(modulo);
  return defPlan(plan).modulos.includes(modulo);
}
