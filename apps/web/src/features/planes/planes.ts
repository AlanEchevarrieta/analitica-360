/**
 * Catálogo de planes y precios (puerto de src/lib/planes.ts del sistema
 * anterior). Precios en pesos, sin IVA.
 */
export const PRECIOS = {
  basico: { mensual: 25000, anual: 20000 },
  pro: { mensual: 70000, anual: 56000 },
  premium: { mensual: 95000, anual: 76000 },
  ecommerce: { mensual: 150000, anual: 120000 },
} as const;

export const DESCUENTO_LANZAMIENTO = 0.4;
export const DESCUENTO_ANUAL = 0.2;
export const MESES_DESCUENTO_LANZAMIENTO = 3;

export type PlanPagoId = keyof typeof PRECIOS;
export type PlanId = "starter" | PlanPagoId;
export type Ciclo = "mensual" | "anual";

export interface PlanDef {
  nombre: string;
  popular?: boolean;
  modulos: readonly string[];
  usuarios: string;
  productos: string;
}

const BASE = ["inicio", "productos", "ventas", "clientes"];
const OPERACION = [...BASE, "compras", "proveedores", "inventario", "soporte"];
const PRO = [...OPERACION, "analytics", "pedidos"];
const PREMIUM = [...PRO, "insights", "contabilidad"];

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: "Starter", modulos: BASE, usuarios: "1 usuario", productos: "Hasta 100 productos" },
  basico: { nombre: "Básico", modulos: OPERACION, usuarios: "Hasta 2 usuarios", productos: "Productos ilimitados" },
  pro: { nombre: "Pro", modulos: PRO, usuarios: "Hasta 5 usuarios", productos: "Productos ilimitados" },
  premium: { nombre: "Premium", popular: true, modulos: PREMIUM, usuarios: "Usuarios ilimitados", productos: "Productos ilimitados" },
  ecommerce: { nombre: "E-commerce", modulos: [...PREMIUM, "tienda"], usuarios: "Usuarios ilimitados", productos: "Productos ilimitados" },
};

export const PLANES_PAGOS: PlanPagoId[] = ["basico", "pro", "premium", "ecommerce"];

export const MODULOS: { id: string; etiqueta: string }[] = [
  { id: "inicio", etiqueta: "Inicio" },
  { id: "productos", etiqueta: "Productos" },
  { id: "ventas", etiqueta: "Ventas" },
  { id: "clientes", etiqueta: "Clientes" },
  { id: "compras", etiqueta: "Compras" },
  { id: "proveedores", etiqueta: "Proveedores" },
  { id: "inventario", etiqueta: "Inventario" },
  { id: "soporte", etiqueta: "Soporte" },
  { id: "analytics", etiqueta: "Analytics" },
  { id: "pedidos", etiqueta: "Pedidos" },
  { id: "insights", etiqueta: "Insights" },
  { id: "contabilidad", etiqueta: "Contabilidad y estados contables" },
  { id: "tienda", etiqueta: "Tienda online" },
];

/** "Básico", "business" (nombre viejo de Premium), etc. -> id del plan. */
export function idPlan(nombre: string | null | undefined): PlanId {
  const p = (nombre ?? "").trim().toLowerCase();
  if (p === "básico") return "basico";
  if (p === "business") return "premium";
  return p === "basico" || p === "pro" || p === "premium" || p === "ecommerce" ? p : "starter";
}

/** Precio por mes que se paga hoy (mensual o anual): el de lanzamiento, 40% OFF los primeros 3 meses. */
export function precioVigente(plan: PlanPagoId) {
  return Math.round(PRECIOS[plan].mensual * (1 - DESCUENTO_LANZAMIENTO));
}

/** Anual: meses 1-3 con el descuento de lanzamiento y 4-12 con el anual (no se acumulan). */
export function desgloseAnual(plan: PlanPagoId) {
  const lista = PRECIOS[plan].mensual;
  const mes1a3 = Math.round(lista * (1 - DESCUENTO_LANZAMIENTO));
  const mes4a12 = Math.round(lista * (1 - DESCUENTO_ANUAL));
  return { lista, mes1a3, mes4a12, total: mes1a3 * 3 + mes4a12 * 9 };
}

export const ESTADOS_SUSCRIPCION: Record<string, string> = {
  activa: "Activo",
  periodo_prueba: "Período de prueba",
  pendiente_pago: "Pendiente de pago",
  vencida: "Vencido",
  cancelada: "Cancelado",
};

/** Contacto para contratar: WhatsApp si está configurado; si no, un ticket de soporte ya completado. */
export function linkContratar(plan: PlanPagoId, ciclo: Ciclo) {
  const nombre = PLANES[plan].nombre;
  const numero = (process.env.NEXT_PUBLIC_WHATSAPP_CONTACT ?? "").replace(/\D/g, "");
  if (numero) {
    const texto = encodeURIComponent(`Hola, quiero contratar el plan ${nombre}${ciclo === "anual" ? " con pago anual" : ""} de Analítica 360`);
    return { href: `https://wa.me/${numero}?text=${texto}`, externo: true };
  }
  return { href: `/soporte/nuevo?plan=${plan}&ciclo=${ciclo}`, externo: false };
}
