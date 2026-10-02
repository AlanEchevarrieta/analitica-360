/**
 * Catálogo de planes y precios (puerto de src/lib/planes.ts del sistema
 * anterior). Precios en pesos, sin IVA.
 */
/** Precio de LISTA por mes, sin IVA (2026-10-02). Sin promociones al público: los descuentos vienen de códigos (cámaras y cupones). */
export const PRECIO_MENSUAL = {
  basico: 49000,
  pro: 89000,
  ecommerce: 149000,
} as const;

export type PlanPagoId = keyof typeof PRECIO_MENSUAL;
export type PlanId = "starter" | PlanPagoId;
export type Ciclo = "mensual" | "trimestral" | "anual";
export const CICLOS: { id: Ciclo; nombre: string; meses: number }[] = [
  { id: "mensual", nombre: "Mensual", meses: 1 },
  { id: "trimestral", nombre: "Trimestral", meses: 3 },
  { id: "anual", nombre: "Anual", meses: 12 },
];

export interface PlanDef {
  nombre: string;
  popular?: boolean;
  modulos: readonly string[];
  usuarios: string;
  productos: string;
}

const BASE = ["inicio", "productos", "ventas", "clientes"];
const OPERACION = [...BASE, "compras", "proveedores", "inventario", "soporte"];
/** Pro absorbe al ex Premium (2026-10-02). PENDIENTE: definir módulos y límites de cada plan. */
const PRO = [...OPERACION, "analytics", "pedidos", "produccion", "insights", "contabilidad"];

export const PLANES: Record<PlanId, PlanDef> = {
  starter: { nombre: "Starter", modulos: BASE, usuarios: "1 usuario", productos: "Hasta 100 productos" },
  basico: { nombre: "Básico", modulos: OPERACION, usuarios: "Hasta 2 usuarios", productos: "Productos ilimitados" },
  pro: { nombre: "Pro", popular: true, modulos: PRO, usuarios: "Usuarios ilimitados", productos: "Productos ilimitados" },
  ecommerce: { nombre: "E-commerce", modulos: [...PRO, "tienda"], usuarios: "Usuarios ilimitados", productos: "Productos ilimitados" },
};

export const PLANES_PAGOS: PlanPagoId[] = ["basico", "pro", "ecommerce"];

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
  { id: "produccion", etiqueta: "Producción (recetas, fabricación y kits)" },
  { id: "insights", etiqueta: "Insights" },
  { id: "contabilidad", etiqueta: "Contabilidad y estados contables" },
  { id: "tienda", etiqueta: "Tienda online" },
];

/** "Básico" → basico; "Premium" y "business" (nombres viejos) → pro. */
export function idPlan(nombre: string | null | undefined): PlanId {
  const p = (nombre ?? "").trim().toLowerCase();
  if (p === "básico") return "basico";
  if (p === "premium" || p === "business") return "pro";
  return p === "basico" || p === "pro" || p === "ecommerce" ? p : "starter";
}

export const ESTADOS_SUSCRIPCION: Record<string, string> = {
  activa: "Activo",
  periodo_prueba: "Período de prueba",
  pendiente_pago: "Pendiente de pago",
  vencida: "Vencido",
  cancelada: "Cancelado",
};

/** Contacto para contratar: WhatsApp (con plan, ciclo, código y precio) si está configurado; si no, un ticket de soporte ya completado. */
export function linkContratar(plan: PlanPagoId, ciclo: Ciclo, extra: { codigo?: string | null; detallePrecio?: string } = {}) {
  const nombre = PLANES[plan].nombre;
  const numero = (process.env.NEXT_PUBLIC_WHATSAPP_CONTACT ?? "").replace(/\D/g, "");
  if (numero) {
    const partes = [`Hola, quiero contratar el plan ${nombre} con pago ${ciclo} de Analítica 360`];
    if (extra.codigo) partes.push(`Tengo el código ${extra.codigo}`);
    if (extra.detallePrecio) partes.push(extra.detallePrecio);
    return { href: `https://wa.me/${numero}?text=${encodeURIComponent(partes.join(". "))}`, externo: true };
  }
  return { href: `/soporte/nuevo?plan=${plan}&ciclo=${ciclo}${extra.codigo ? `&codigo=${extra.codigo}` : ""}`, externo: false };
}
