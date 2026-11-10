import type { Funcion } from "./planes";

export type ActividadNegocio = "productos" | "produccion" | "servicios";

export type ModuloGrupo = "Ventas" | "Stock y compras" | "Gestión" | "Online" | "Extras";

export type ModuloToggleId =
  | "caja"
  | "cobros"
  | "clientes"
  | "pedidos"
  | "agenda"
  | "abonos"
  | "ordenes_trabajo"
  | "proyectos"
  | "comisiones"
  | "inventario"
  | "compras"
  | "proveedores"
  | "produccion"
  | "analytics"
  | "objetivos"
  | "documentos"
  | "tienda"
  | "mercadopago"
  | "envios"
  | "copilot"
  | "radar_precios";

export interface ModuloDef {
  id: ModuloToggleId;
  nombre: string;
  descripcion: string;
  icono: string;
  grupo: ModuloGrupo;
  /** Si se define, se prende por defecto solo cuando el negocio tiene alguna de estas actividades. */
  para?: readonly ActividadNegocio[];
  /** Función del plan necesaria para prender este módulo. */
  funcion?: Funcion;
  /** Módulos que se prenden automáticamente al prender este. */
  dependeDe?: readonly ModuloToggleId[];
}

/** Módulos estructurales que siempre están prendidos y no se pueden apagar. */
export const MODULOS_SIEMPRE_PRENDIDOS = [
  "inicio",
  "ventas",
  "productos",
  "configuracion",
  "planes",
  "soporte",
] as const;

export const GRUPOS_MODULOS: readonly ModuloGrupo[] = [
  "Ventas",
  "Stock y compras",
  "Gestión",
  "Online",
  "Extras",
];

export const MODULOS_CATALOGO: readonly ModuloDef[] = [
  // Ventas
  {
    id: "caja",
    nombre: "Caja y turnos",
    descripcion: "Apertura, cierre y arqueo de efectivo por turno.",
    icono: "Landmark",
    grupo: "Ventas",
  },
  {
    id: "cobros",
    nombre: "Cobros",
    descripcion: "Seguimiento de cobros y links de pago.",
    icono: "CreditCard",
    grupo: "Ventas",
  },
  {
    id: "clientes",
    nombre: "Clientes",
    descripcion: "Ficha de clientes, cuenta corriente y segmentos.",
    icono: "Users",
    grupo: "Ventas",
    funcion: "clientes",
  },
  {
    id: "pedidos",
    nombre: "Pedidos",
    descripcion: "Preparación, armado y entrega de pedidos.",
    icono: "Truck",
    grupo: "Ventas",
    para: ["productos", "produccion"],
    funcion: "pedidos",
    dependeDe: ["inventario"],
  },
  {
    id: "agenda",
    nombre: "Agenda",
    descripcion: "Turnos, reservas online y recordatorios.",
    icono: "CalendarDays",
    grupo: "Ventas",
    para: ["servicios"],
    funcion: "agenda",
  },
  {
    id: "abonos",
    nombre: "Abonos",
    descripcion: "Cobros recurrentes y membresías mensuales.",
    icono: "Repeat",
    grupo: "Ventas",
    para: ["servicios"],
    funcion: "abonos",
  },
  {
    id: "ordenes_trabajo",
    nombre: "Órdenes de trabajo",
    descripcion: "Reparaciones, service técnico y encargos a medida.",
    icono: "Wrench",
    grupo: "Ventas",
    para: ["servicios"],
    funcion: "ordenes_trabajo",
  },
  {
    id: "proyectos",
    nombre: "Proyectos",
    descripcion: "Trabajos por etapas con aprobaciones y control de plazos.",
    icono: "KanbanSquare",
    grupo: "Ventas",
    para: ["servicios"],
    funcion: "proyectos",
  },
  {
    id: "comisiones",
    nombre: "Comisiones",
    descripcion: "Liquidación de comisiones por profesional o vendedor.",
    icono: "HandCoins",
    grupo: "Ventas",
    para: ["servicios"],
    funcion: "comisiones",
    dependeDe: ["agenda"],
  },
  // Stock y compras
  {
    id: "inventario",
    nombre: "Inventario",
    descripcion: "Stock por depósito, alertas de faltantes y movimientos.",
    icono: "ClipboardList",
    grupo: "Stock y compras",
    para: ["productos", "produccion"],
    funcion: "inventario",
  },
  {
    id: "compras",
    nombre: "Compras",
    descripcion: "Facturas de compra, reposición y órdenes a proveedores.",
    icono: "ShoppingCart",
    grupo: "Stock y compras",
    para: ["productos", "produccion"],
    funcion: "compras",
  },
  {
    id: "proveedores",
    nombre: "Proveedores",
    descripcion: "Agenda de proveedores y seguimiento de costos.",
    icono: "Factory",
    grupo: "Stock y compras",
    para: ["productos", "produccion"],
    funcion: "proveedores",
  },
  {
    id: "produccion",
    nombre: "Producción",
    descripcion: "Recetas, insumos y costo de fabricar tus productos.",
    icono: "Hammer",
    grupo: "Stock y compras",
    para: ["produccion"],
    funcion: "produccion",
    dependeDe: ["inventario"],
  },
  // Gestión
  {
    id: "analytics",
    nombre: "Analytics",
    descripcion: "Ganancia real, estado de resultados y métricas del negocio.",
    icono: "BarChart3",
    grupo: "Gestión",
    funcion: "analytics",
  },
  {
    id: "objetivos",
    nombre: "Objetivos",
    descripcion: "Metas mensuales de ventas y ritmo diario.",
    icono: "Target",
    grupo: "Gestión",
    funcion: "objetivos",
  },
  {
    id: "documentos",
    nombre: "Documentos",
    descripcion: "Archivo de contratos, comprobantes y vencimientos.",
    icono: "FolderOpen",
    grupo: "Gestión",
    funcion: "archivo",
  },
  // Online
  {
    id: "tienda",
    nombre: "Tienda online",
    descripcion: "Catálogo web con carrito de compras propio.",
    icono: "Store",
    grupo: "Online",
    para: ["productos", "produccion"],
    funcion: "tienda",
  },
  {
    id: "mercadopago",
    nombre: "Mercado Pago",
    descripcion: "Cobros online con tarjeta y dinero en cuenta.",
    icono: "CreditCard",
    grupo: "Online",
    para: ["productos", "produccion"],
    funcion: "tienda",
    dependeDe: ["tienda"],
  },
  {
    id: "envios",
    nombre: "Envíos",
    descripcion: "Cotización, etiquetas y seguimiento de paquetes.",
    icono: "Truck",
    grupo: "Online",
    para: ["productos", "produccion"],
    funcion: "pedidos",
    dependeDe: ["pedidos"],
  },
  // Extras
  {
    id: "copilot",
    nombre: "Copilot IA",
    descripcion: "Asistente inteligente conectado a los números de tu negocio.",
    icono: "Sparkles",
    grupo: "Extras",
    funcion: "copilot",
  },
  {
    id: "radar_precios",
    nombre: "Radar de precios",
    descripcion: "Comparación de tus precios frente al mercado.",
    icono: "Radar",
    grupo: "Extras",
    para: ["productos", "produccion"],
    funcion: "analytics",
  },
] as const;

export const MODULO_IDS: readonly ModuloToggleId[] = MODULOS_CATALOGO.map((m) => m.id);

export function esModuloToggleId(id: string): id is ModuloToggleId {
  return (MODULO_IDS as readonly string[]).includes(id);
}

/** Qué módulos quedan prendidos de entrada según las actividades del negocio. */
export function sugerirModulosPorActividades(
  actividades: readonly string[],
): Record<ModuloToggleId, boolean> {
  const act = actividades.length > 0 ? actividades : ["productos", "produccion"];
  const res = {} as Record<ModuloToggleId, boolean>;
  for (const m of MODULOS_CATALOGO) {
    res[m.id] = !m.para || m.para.some((a) => act.includes(a));
  }
  return res;
}

/**
 * Calcula el mapa efectivo de módulos combinando lo sugerido por `actividades`
 * con los cambios manuales guardados en `modulos`.
 */
export function calcularModulosEfectivos(
  actividades: readonly string[],
  guardados?: Record<string, unknown> | null,
): Record<ModuloToggleId, boolean> {
  const base = sugerirModulosPorActividades(actividades);
  if (!guardados || typeof guardados !== "object") return base;
  for (const [k, v] of Object.entries(guardados)) {
    if (esModuloToggleId(k) && typeof v === "boolean") {
      base[k] = v;
    }
  }
  return base;
}

/**
 * Aplica cambios de módulos respetando las dependencias: si se prende un módulo
 * que depende de otro, también se prende su dependencia (transitiva).
 */
export function aplicarDependenciasModulos(
  actividades: readonly string[],
  guardadosActuales: Record<string, boolean>,
  cambios: Record<string, boolean>,
): {
  modulos: Record<string, boolean>;
  modulosEfectivos: Record<ModuloToggleId, boolean>;
  prendidosPorDependencia: ModuloToggleId[];
} {
  const limpio: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(guardadosActuales)) {
    if (esModuloToggleId(k) && typeof v === "boolean") limpio[k] = v;
  }
  const efectivosAntes = calcularModulosEfectivos(actividades, limpio);
  const prendidosPorDependencia: ModuloToggleId[] = [];

  const prenderConDependencias = (id: ModuloToggleId, visitados = new Set<ModuloToggleId>()) => {
    if (visitados.has(id)) return;
    visitados.add(id);
    const def = MODULOS_CATALOGO.find((m) => m.id === id);
    if (!def?.dependeDe) return;
    for (const dep of def.dependeDe) {
      if (limpio[dep] === false || (!efectivosAntes[dep] && limpio[dep] !== true)) {
        if (!prendidosPorDependencia.includes(dep) && cambios[dep] !== true) {
          prendidosPorDependencia.push(dep);
        }
      }
      limpio[dep] = true;
      prenderConDependencias(dep, visitados);
    }
  };

  for (const [k, v] of Object.entries(cambios)) {
    if (!esModuloToggleId(k) || typeof v !== "boolean") continue;
    limpio[k] = v;
    if (v) prenderConDependencias(k);
  }

  return {
    modulos: limpio,
    modulosEfectivos: calcularModulosEfectivos(actividades, limpio),
    prendidosPorDependencia,
  };
}
