import type { ModuloToggleId } from "@analitica360/shared-types";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Gift,
  Hammer,
  HandCoins,
  Home,
  KanbanSquare,
  Landmark,
  LineChart,
  Package,
  PlusCircle,
  Radar,
  Receipt,
  Repeat,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tags,
  Target,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ModuloClave } from "@/lib/rol";
import type { Actividad } from "@/lib/rubros";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  modulo?: ModuloClave;
  moduloId?: ModuloToggleId;
  funcion?: string;
  para?: Actividad[];
  visible?: boolean;
  keywords?: string[];
}

export interface NavGrupo {
  id: string;
  titulo: string;
  colapsable?: boolean;
  defaultAbierto?: boolean;
  items: NavItem[];
}

export interface AccionRapida {
  id: string;
  href: string;
  label: string;
  descripcion: string;
  icon: LucideIcon;
  modulo?: ModuloClave;
  moduloId?: ModuloToggleId;
  funcion?: string;
  para?: Actividad[];
  keywords: string[];
}

/**
 * Grupos principales del menú lateral.
 * Ordenados por frecuencia de uso: Operación diaria -> Operativa/Rubro -> Gestión e IA.
 */
export const GRUPOS_NAVEGACION: NavGrupo[] = [
  {
    id: "operacion",
    titulo: "Operación diaria",
    colapsable: false,
    defaultAbierto: true,
    items: [
      {
        href: "/ventas",
        label: "Ventas",
        icon: Wallet,
        modulo: "ventas",
        keywords: ["pos", "facturar", "cobrar", "ticket", "presupuestos", "devoluciones"],
      },
      {
        href: "/caja",
        label: "Caja y turnos",
        icon: Landmark,
        modulo: "ventas",
        moduloId: "caja",
        keywords: ["arqueo", "efectivo", "turno", "cierre", "sangria", "reporte z"],
      },
      {
        href: "/cobros",
        label: "Cobros y links",
        icon: CreditCard,
        modulo: "ventas",
        moduloId: "cobros",
        keywords: ["mercadopago", "uala", "stripe", "qr", "link de pago", "pasarelas"],
      },
      {
        href: "/clientes",
        label: "Clientes",
        icon: Users,
        modulo: "clientes",
        moduloId: "clientes",
        keywords: ["crm", "cuenta corriente", "difusiones", "segmentos", "whatsapp"],
      },
      {
        href: "/productos",
        label: "Catálogo",
        icon: Package,
        modulo: "productos",
        keywords: ["articulos", "servicios", "precios", "variantes", "radar", "excel"],
      },
    ],
  },
  {
    id: "operativa",
    titulo: "Stock, compras y servicios",
    colapsable: true,
    defaultAbierto: true,
    items: [
      {
        href: "/pedidos",
        label: "Pedidos",
        icon: Truck,
        modulo: "pedidos",
        moduloId: "pedidos",
        para: ["productos", "produccion"],
        keywords: ["picking", "despacho", "envios", "remito", "tienda"],
      },
      {
        href: "/inventario",
        label: "Inventario",
        icon: ClipboardList,
        modulo: "inventario",
        moduloId: "inventario",
        para: ["productos", "produccion"],
        keywords: ["stock", "depositos", "kardex", "lotes", "movimientos", "vencimientos"],
      },
      {
        href: "/compras",
        label: "Compras",
        icon: ShoppingCart,
        modulo: "compras",
        moduloId: "compras",
        para: ["productos", "produccion"],
        keywords: ["mercaderia", "ordenes de compra", "facturas proveedor"],
      },
      {
        href: "/proveedores",
        label: "Proveedores",
        icon: Store,
        modulo: "proveedores",
        moduloId: "proveedores",
        para: ["productos", "produccion"],
        keywords: ["directorio", "saldos", "compras"],
      },
      {
        href: "/produccion",
        label: "Producción",
        icon: Hammer,
        modulo: "produccion",
        moduloId: "produccion",
        para: ["produccion"],
        keywords: ["recetas", "formulas", "fabricacion", "insumos"],
      },
      {
        href: "/agenda",
        label: "Agenda",
        icon: CalendarDays,
        modulo: "ventas",
        moduloId: "agenda",
        funcion: "agenda",
        para: ["servicios"],
        keywords: ["turnos", "citas", "reservas", "calendario"],
      },
      {
        href: "/abonos",
        label: "Abonos",
        icon: Repeat,
        modulo: "ventas",
        moduloId: "abonos",
        funcion: "abonos",
        para: ["servicios"],
        keywords: ["membresias", "cuotas", "recurrentes", "suscripciones"],
      },
      {
        href: "/ordenes-trabajo",
        label: "Órdenes de trabajo",
        icon: Wrench,
        modulo: "ventas",
        moduloId: "ordenes_trabajo",
        funcion: "ordenes_trabajo",
        para: ["servicios"],
        keywords: ["taller", "service", "reparaciones", "equipos"],
      },
      {
        href: "/proyectos",
        label: "Proyectos",
        icon: KanbanSquare,
        modulo: "ventas",
        moduloId: "proyectos",
        funcion: "proyectos",
        para: ["servicios"],
        keywords: ["etapas", "tablero", "entregables", "aprobaciones"],
      },
    ],
  },
  {
    id: "gestion",
    titulo: "Gestión y analítica",
    colapsable: true,
    defaultAbierto: false,
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        modulo: "analytics",
        moduloId: "analytics",
        keywords: ["rentabilidad", "margen", "monotributo", "contabilidad", "libro", "insights"],
      },
      {
        href: "/objetivos",
        label: "Objetivos",
        icon: Target,
        moduloId: "objetivos",
        funcion: "objetivos",
        keywords: ["metas", "vendedores", "avance"],
      },
      {
        href: "/comisiones",
        label: "Comisiones",
        icon: HandCoins,
        modulo: "ventas",
        moduloId: "comisiones",
        funcion: "comisiones",
        para: ["servicios"],
        keywords: ["liquidaciones", "personal", "porcentaje"],
      },
      {
        href: "/documentos",
        label: "Documentos",
        icon: FolderOpen,
        moduloId: "documentos",
        funcion: "archivo",
        keywords: ["archivo", "contratos", "polizas", "vencimientos"],
      },
    ],
  },
];

/**
 * Subrutas indexadas en el buscador global (⌘K) para saltar sin navegar por múltiples pantallas.
 */
export const SUBRUTAS_BUSCADOR: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: Home, modulo: "inicio", keywords: ["dashboard", "resumen", "hoy"] },
  { href: "/ia", label: "Copilot IA", icon: Sparkles, funcion: "copilot", moduloId: "copilot", keywords: ["asistente", "inteligencia", "chat"] },
  { href: "/ventas/nueva", label: "Nueva venta (POS)", icon: PlusCircle, modulo: "ventas", keywords: ["punto de venta", "cobrar", "factura", "carrito"] },
  { href: "/ventas/presupuestos", label: "Presupuestos", icon: Receipt, modulo: "ventas", funcion: "presupuestos", keywords: ["cotizacion", "presupuesto"] },
  { href: "/ventas/devoluciones", label: "Devoluciones y notas de crédito", icon: Repeat, modulo: "ventas", keywords: ["reembolso", "credito", "cambio"] },
  { href: "/clientes/cuenta-corriente", label: "Cuenta corriente de clientes", icon: Wallet, modulo: "clientes", funcion: "cuenta_corriente", keywords: ["fiado", "deuda", "saldo"] },
  { href: "/clientes/segmentos", label: "Segmentos y difusiones", icon: Users, modulo: "clientes", funcion: "difusiones", keywords: ["whatsapp", "vip", "cumpleanos"] },
  { href: "/productos/radar", label: "Radar de precios", icon: Radar, modulo: "productos", keywords: ["competencia", "mercadolibre", "benchmark"] },
  { href: "/productos/precios", label: "Actualización masiva de precios", icon: Tags, modulo: "productos", keywords: ["aumentar", "porcentaje", "listas"] },
  { href: "/productos/importar", label: "Importar productos desde Excel", icon: FileSpreadsheet, modulo: "productos", funcion: "importar", keywords: ["csv", "xlsx", "planilla"] },
  { href: "/inventario/movimientos", label: "Movimientos de stock (Kardex)", icon: ClipboardList, modulo: "inventario", para: ["productos", "produccion"], keywords: ["entradas", "salidas", "ajustes"] },
  { href: "/compras/ordenes", label: "Órdenes de compra", icon: ShoppingCart, modulo: "compras", para: ["productos", "produccion"], keywords: ["reposicion", "pendientes"] },
  { href: "/analytics/ventas", label: "Analytics de ventas", icon: TrendingUp, modulo: "analytics", keywords: ["periodo", "canales", "facturacion"] },
  { href: "/analytics/productos", label: "Rentabilidad por producto", icon: LineChart, modulo: "analytics", keywords: ["margen", "ganancia", "bcg"] },
  { href: "/analytics/contabilidad", label: "Contabilidad e impuestos", icon: FileText, modulo: "contabilidad", keywords: ["iva", "monotributo", "arba"] },
  { href: "/analytics/estados", label: "Estados contables", icon: FileText, modulo: "contabilidad", keywords: ["balance", "resultados"] },
  { href: "/analytics/libro", label: "Libro diario", icon: BookOpen, modulo: "contabilidad", keywords: ["asientos", "contable"] },
  { href: "/analytics/insights", label: "Insights y pronósticos", icon: Sparkles, modulo: "insights", keywords: ["proyeccion", "tendencias"] },
  { href: "/guias", label: "Guías y manuales", icon: BookOpen, keywords: ["ayuda", "documentacion", "obsidian", "tutorial"] },
  { href: "/soporte", label: "Soporte técnico", icon: Ticket, keywords: ["tickets", "ayuda", "reclamo"] },
  { href: "/planes", label: "Planes y suscripción", icon: Star, keywords: ["pro", "pago", "facturacion", "upgrade"] },
  { href: "/recomendar", label: "Recomendá y ganá", icon: Gift, modulo: "configuracion", keywords: ["referidos", "descuento"] },
  { href: "/configuracion", label: "Configuración general", icon: Settings, modulo: "configuracion", keywords: ["arca", "fiscal", "equipo", "apariencia", "tienda"] },
  { href: "/configuracion?s=tienda", label: "Configurar tienda online", icon: Store, modulo: "configuracion", funcion: "tienda", keywords: ["ecommerce", "catalogo web"] },
  { href: "/configuracion?s=factura", label: "Factura electrónica ARCA", icon: Receipt, modulo: "configuracion", keywords: ["afip", "certificado", "cuit"] },
  { href: "/configuracion?s=equipo", label: "Equipo y permisos", icon: Users, modulo: "configuracion", keywords: ["roles", "colaboradores", "usuarios"] },
  { href: "/configuracion?s=apariencia", label: "Apariencia y colores", icon: Settings, modulo: "configuracion", keywords: ["tema", "oscuro", "claro", "paleta"] },
  { href: "/admin", label: "Consola Superadmin", icon: Shield, keywords: ["admin", "saas", "clientes"] },
];

/**
 * Acciones rápidas directas desde ⌘K.
 */
export const ACCIONES_RAPIDAS: AccionRapida[] = [
  {
    id: "nueva-venta",
    href: "/ventas/nueva",
    label: "Nueva venta (POS)",
    descripcion: "Abrir el carrito de cobro rápido",
    icon: PlusCircle,
    modulo: "ventas",
    keywords: ["vender", "pos", "cobrar", "factura"],
  },
  {
    id: "nuevo-cliente",
    href: "/clientes/nuevo",
    label: "Nuevo cliente",
    descripcion: "Registrar un cliente en el directorio",
    icon: Users,
    modulo: "clientes",
    moduloId: "clientes",
    keywords: ["alta cliente", "contacto"],
  },
  {
    id: "nuevo-producto",
    href: "/productos/nuevo",
    label: "Nuevo producto",
    descripcion: "Agregar artículo o servicio al catálogo",
    icon: Package,
    modulo: "productos",
    keywords: ["alta producto", "articulo", "sku"],
  },
  {
    id: "nuevo-presupuesto",
    href: "/ventas/presupuestos/nuevo",
    label: "Nuevo presupuesto",
    descripcion: "Crear cotización para un cliente",
    icon: Receipt,
    modulo: "ventas",
    funcion: "presupuestos",
    keywords: ["cotizar", "presupuestar"],
  },
  {
    id: "nueva-compra",
    href: "/compras/nueva",
    label: "Registrar compra",
    descripcion: "Cargar factura de compra e ingresar stock",
    icon: ShoppingCart,
    modulo: "compras",
    moduloId: "compras",
    para: ["productos", "produccion"],
    keywords: ["compra proveedor", "ingreso mercaderia"],
  },
  {
    id: "nuevo-proyecto",
    href: "/proyectos/nuevo",
    label: "Nuevo proyecto",
    descripcion: "Iniciar proyecto con etapas y plazos",
    icon: KanbanSquare,
    modulo: "ventas",
    moduloId: "proyectos",
    funcion: "proyectos",
    para: ["servicios"],
    keywords: ["crear proyecto", "etapas"],
  },
  {
    id: "nuevo-ticket",
    href: "/soporte/nuevo",
    label: "Nuevo ticket de soporte",
    descripcion: "Contactar al equipo de soporte técnico",
    icon: Ticket,
    keywords: ["reportar error", "ayuda"],
  },
];

/**
 * Etiquetas legibles para los segmentos de ruta en los breadcrumbs.
 */
export const ETIQUETAS_RUTA: Record<string, string> = {
  inicio: "Inicio",
  ia: "Copilot IA",
  ventas: "Ventas",
  nueva: "Nueva",
  nuevo: "Nuevo",
  presupuestos: "Presupuestos",
  devoluciones: "Devoluciones",
  caja: "Caja y turnos",
  cobros: "Cobros y links",
  clientes: "Clientes",
  "cuenta-corriente": "Cuenta corriente",
  segmentos: "Segmentos y difusiones",
  productos: "Catálogo",
  radar: "Radar de precios",
  precios: "Actualización de precios",
  importar: "Importar Excel",
  pedidos: "Pedidos",
  remito: "Remito",
  inventario: "Inventario",
  movimientos: "Movimientos",
  compras: "Compras",
  ordenes: "Órdenes de compra",
  proveedores: "Proveedores",
  produccion: "Producción",
  receta: "Receta",
  agenda: "Agenda",
  abonos: "Abonos",
  "ordenes-trabajo": "Órdenes de trabajo",
  proyectos: "Proyectos",
  analytics: "Analytics",
  contabilidad: "Contabilidad",
  estados: "Estados contables",
  libro: "Libro diario",
  insights: "Insights",
  objetivos: "Objetivos",
  comisiones: "Comisiones",
  documentos: "Documentos",
  guias: "Guías y manuales",
  soporte: "Soporte",
  planes: "Planes",
  recomendar: "Recomendá y ganá",
  configuracion: "Configuración",
  admin: "Consola",
  alianzas: "Alianzas",
  cuotas: "Cuotas",
  cupones: "Cupones",
  auditoria: "Auditoría",
  pagos: "Pagos",
  sistema: "Sistema",
  eventos: "Eventos",
  uso: "Uso",
  usuarios: "Usuarios",
};

export function formatoSegmentoRuta(segmento: string, indice: number, segmentos: string[]): string {
  if (ETIQUETAS_RUTA[segmento]) return ETIQUETAS_RUTA[segmento];
  // Evitar mostrar UUIDs o IDs crudos largos en la miga de pan
  if (/^[0-9a-f-]{8,}$/i.test(segmento) || /^\d+$/.test(segmento) || segmento.length > 20) {
    return "Detalle";
  }
  if (indice > 0 && segmentos[indice - 1] === "guias") {
    return "Manual";
  }
  return segmento.charAt(0).toUpperCase() + segmento.slice(1).replace(/-/g, " ");
}
