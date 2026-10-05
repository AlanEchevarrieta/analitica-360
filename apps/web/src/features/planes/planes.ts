import { PLANES as COMPARTIDO } from "@analitica360/shared-types";

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
  /** Ubicaciones (local, depósito, ferias). */
  productos: string;
}

const limite = (n: number | null, uno: string, varios: string) => (n == null ? `${varios[0].toUpperCase()}${varios.slice(1)} ilimitados` : n === 1 ? `1 ${uno}` : `Hasta ${n} ${varios}`);
const ubicaciones = (n: number | null) => (n == null ? "Ubicaciones ilimitadas" : n === 1 ? "1 ubicación" : `Hasta ${n} ubicaciones`);

/** Lo que trae cada plan sale del catálogo compartido con la API (packages/shared-types): lo que se muestra es lo que se aplica. */
function def(id: PlanId, popular = false): PlanDef {
  const p = COMPARTIDO[id];
  return { nombre: p.nombre, popular, modulos: p.funciones, usuarios: limite(p.maxUsuarios, "usuario", "usuarios"), productos: ubicaciones(p.maxUbicaciones) };
}

export const PLANES: Record<PlanId, PlanDef> = {
  starter: def("starter"),
  basico: def("basico"),
  pro: def("pro", true),
  ecommerce: def("ecommerce"),
};

export const PLANES_PAGOS: PlanPagoId[] = ["basico", "pro", "ecommerce"];

export const MODULOS: { id: string; etiqueta: string }[] = [
  { id: "ventas", etiqueta: "Ventas, productos y clientes" },
  { id: "inventario", etiqueta: "Compras, proveedores e inventario" },
  { id: "analytics", etiqueta: "Analytics" },
  { id: "insights", etiqueta: "Insights (pronósticos y combos)" },
  { id: "contabilidad", etiqueta: "Contabilidad y estados contables" },
  { id: "pedidos", etiqueta: "Pedidos con preparación y remitos" },
  { id: "produccion", etiqueta: "Producción (recetas, fabricación y kits)" },
  { id: "listas_precios", etiqueta: "Listas de precios y cuenta corriente" },
  { id: "difusiones", etiqueta: "Segmentos y difusiones por WhatsApp" },
  { id: "importar", etiqueta: "Importar desde Excel" },
  { id: "auditoria", etiqueta: "Bitácora de auditoría" },
  { id: "informe_mensual", etiqueta: "Informe mensual por email (el semanal va en todos los planes)" },
  { id: "tienda", etiqueta: "Tienda online (ofertas, cupones y cuentas de compradores)" },
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
