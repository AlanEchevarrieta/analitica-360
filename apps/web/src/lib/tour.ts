import { driver, type Config, type DriveStep } from "driver.js";

export const CLAVE_TOUR_COMPLETADO = "analitica360_tour_visto";

export function haVistoTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CLAVE_TOUR_COMPLETADO) === "true";
  } catch {
    return false;
  }
}

export function marcarTourCompletado(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLAVE_TOUR_COMPLETADO, "true");
  } catch {
    // ignorar en entornos restringidos
  }
}

export interface DefinicionTourModulo {
  id: string;
  nombre: string;
  ruta: string;
  icono: string;
  descripcionCorta: string;
  pasos: DriveStep[];
}

/**
 * Catálogo exhaustivo de tours interactivos con Driver.js módulo por módulo.
 * Cada tour es ágil, conciso (3 a 5 pasos clave) y enfocado en la operativa real sin saturar de texto.
 */
export const TOURS_MODULOS: Record<string, DefinicionTourModulo> = {
  general: {
    id: "general",
    nombre: "Tour General de Navegación",
    ruta: "/inicio",
    icono: "Compass",
    descripcionCorta: "Visión panorámica de la barra lateral, sucursales y accesos clave.",
    pasos: [
      {
        popover: {
          title: "🚀 Bienvenido a Analítica 360",
          description:
            "Te guiaremos en 1 minuto por los módulos esenciales para operar tu comercio con agilidad.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        element: "#tour-inicio",
        popover: {
          title: "🏠 Panel de Inicio",
          description: "Métricas del día: facturación, compras del mes, alertas de stock y gráfico semanal.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        element: "#tour-copilot",
        popover: {
          title: "✨ Copilot IA (Analítica IA)",
          description: "Asistente inteligente para análisis de rentabilidad, predicción de demanda y consultas comerciales.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        element: "#tour-ventas",
        popover: {
          title: "💳 Punto de Venta y Cobranzas",
          description: "Caja rápida, facturación electrónica ARCA, señas y cobro con múltiples medios de pago.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        element: "#tour-productos",
        popover: {
          title: "📦 Stock y Catálogo",
          description: "Inventario en tiempo real, variantes de talles/colores y actualización masiva por Excel.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        element: "#tour-empresa",
        popover: {
          title: "🏢 Selector de Organización",
          description: "Alterná entre sucursales o empresas manteniendo los datos fiscales e inventario 100% aislados.",
          side: "bottom",
          align: "end",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  ventas: {
    id: "ventas",
    nombre: "Punto de Venta (POS) y Cobranzas",
    ruta: "/ventas",
    icono: "Wallet",
    descripcionCorta: "Carrito rápido, facturación ARCA (Facturas A, B, C) y formas de pago.",
    pasos: [
      {
        popover: {
          title: "🛒 Módulo de Ventas y Facturación",
          description: "Diseñado para cobrar a clientes en el mostrador en menos de 10 segundos.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        element: "#tour-ventas",
        popover: {
          title: "1️⃣ Registro Ágil del Carrito",
          description: "Buscá por nombre, código de barras con pistola lectora o elegí productos de favoritos.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Medios de Pago y Cuotas",
          description: "Combiná efectivo, tarjetas con coeficientes de recargo automático, transferencias o MercadoPago.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "3️⃣ Facturación ARCA y Tickets",
          description: "Emisión de comprobantes fiscales (Factura A, B, C o Nota de Crédito) con CAE oficial de ARCA.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "4️⃣ Señas y Cuenta Corriente",
          description: "Permite asentar señas de pedidos futuros o enviar la venta a la cuenta corriente del cliente.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  clientes: {
    id: "clientes",
    nombre: "Gestión de Clientes y Cuentas Corrientes",
    ruta: "/clientes",
    icono: "Users",
    descripcionCorta: "Fichas de clientes, historial de compras, saldos y difusión por WhatsApp.",
    pasos: [
      {
        popover: {
          title: "👥 Cartera de Clientes",
          description: "Centralizá los datos de contacto, CUIT/DNI, categoría fiscal y límites de crédito.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Cuenta Corriente y Deuda",
          description: "Visualizá los comprobantes adeudados, registrá entregas a cuenta y emití recibos de cobro.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Difusión Directa por WhatsApp",
          description: "Enviá promociones, novedades o estados de cuenta a tus clientes con un solo clic.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  pedidos: {
    id: "pedidos",
    nombre: "Gestión de Pedidos, Picking y Despachos",
    ruta: "/pedidos",
    icono: "Truck",
    descripcionCorta: "Flujo operativo de preparación, embalaje y emisión de remitos.",
    pasos: [
      {
        popover: {
          title: "🚚 Bandeja de Pedidos",
          description: "Monitoreá pedidos provenientes del mostrador, WhatsApp o tu Tienda Online.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Picking en Depósito",
          description: "Checklist digital para que los operarios armen paquetes sin errores de mercadería.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Despacho y Remito Oficial",
          description: "Generación automática del remito de entrega y actualización de stock en tiempo real.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  productos: {
    id: "productos",
    nombre: "Catálogo de Productos y Precios",
    ruta: "/productos",
    icono: "Package",
    descripcionCorta: "Alta de artículos, servicios, variantes de talles/colores y listas de precios.",
    pasos: [
      {
        element: "#tour-productos",
        popover: {
          title: "📦 Catálogo de Artículos y Servicios",
          description: "Administrá productos físicos, insumos de producción y servicios por hora o turno.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Variantes y Códigos SKU/EAN",
          description: "Creá combinaciones de talles y colores con sus respectivos códigos de barras para escaneo.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Actualización Masiva por Excel",
          description: "Exportá e importá listas de precios completas para actualizar tus costos de venta en segundos.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  inventario: {
    id: "inventario",
    nombre: "Control de Inventario y Kardex",
    ruta: "/inventario",
    icono: "ClipboardList",
    descripcionCorta: "Multi-depósito, transferencias entre sucursales y auditoría de stock.",
    pasos: [
      {
        popover: {
          title: "📊 Gestión de Stock en Tiempo Real",
          description: "Control preciso de existencias disponibles, reservadas y por debajo del punto de pedido.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Kardex Inmutable",
          description: "Trazabilidad completa: quién ingresó o dio de baja cada unidad con fecha y motivo.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Transferencias entre Sucursales",
          description: "Movilizá mercadería entre depósitos manteniendo los saldos contables sincronizados.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  compras: {
    id: "compras",
    nombre: "Compras y Proveedores",
    ruta: "/compras",
    icono: "ShoppingCart",
    descripcionCorta: "Recepción de mercadería, facturas de compra y cálculo de costo real.",
    pasos: [
      {
        popover: {
          title: "📥 Registro de Compras",
          description: "Ingresá comprobantes de compras para alimentar el stock y mantener actualizados los costos.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Prorrateo de Costos y Fletes",
          description: "Distribución del costo de envío sobre el precio unitario para un margen de ganancia exacto.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Directorio de Proveedores",
          description: "Seguimiento de cuentas corrientes de proveedores y pagos pendientes.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  analytics: {
    id: "analytics",
    nombre: "Analytics Comercial y Rentabilidad",
    ruta: "/analytics",
    icono: "BarChart3",
    descripcionCorta: "Margen bruto real, matriz BCG de productos y semáforo de Monotributo.",
    pasos: [
      {
        element: "#tour-analytics",
        popover: {
          title: "📈 Business Intelligence Comercial",
          description: "Visualizá los números reales de tu negocio sin necesidad de planillas de cálculo externas.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Matriz BCG de Rentabilidad",
          description: "Identificá tus productos Estrella (alta venta y alto margen) y detectá artículos estancados.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Semáforo Fiscal de Monotributo",
          description: "Monitoreá tu acumulado de facturación de los últimos 12 meses para prevenir recategorizaciones o exclusiones.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  copilot: {
    id: "copilot",
    nombre: "Copilot IA (Analítica IA)",
    ruta: "/ia",
    icono: "Sparkles",
    descripcionCorta: "Diagnóstico ejecutivo de transacciones, predicción de ventas y sugerencias comerciales.",
    pasos: [
      {
        element: "#tour-copilot",
        popover: {
          title: "✨ Asistente Estratégico Analítica IA",
          description: "Inteligencia artificial especializada exclusivamente en finanzas, stock y rentabilidad de tu comercio.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Preguntá en Lenguaje Natural",
          description: "Escribí preguntas como: ¿Cuáles son mis 3 productos con mejor margen? o ¿Qué clientes redujeron sus compras este mes?",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "2️⃣ Privacidad y Multi-Tenant Estricto",
          description: "Analítica IA consulta únicamente los datos de tu empresa con aislamiento por organización (RLS).",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  agenda: {
    id: "agenda",
    nombre: "Agenda de Turnos y Citas Online",
    ruta: "/agenda",
    icono: "CalendarDays",
    descripcionCorta: "Calendario semanal/diario, profesionales y turnero público.",
    pasos: [
      {
        popover: {
          title: "📅 Calendario de Turnos y Citas",
          description: "Gestioná reservas de clientes, horarios de profesionales y disponibilidad de consultorios o boxes.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Turnero Público Online",
          description: "Tus clientes reservan directamente desde un enlace web público sin necesidad de llamadas telefónicas.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  abonos: {
    id: "abonos",
    nombre: "Abonos Periódicos y Membresías",
    ruta: "/abonos",
    icono: "Repeat",
    descripcionCorta: "Gestión de suscripciones, generación masiva de cuotas y cobranzas.",
    pasos: [
      {
        popover: {
          title: "🔁 Cuotas y Membresías Recurrentes",
          description: "Ideal para gimnasios, clubes, servicios de mantenimiento o cuotas mensuales de clientes.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Facturación y Cobro Masivo",
          description: "Generá las cuotas del mes para todos tus abonados con un solo clic y hacé seguimiento de morosos.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  ordenes: {
    id: "ordenes",
    nombre: "Órdenes de Trabajo y Taller",
    ruta: "/ordenes-trabajo",
    icono: "Wrench",
    descripcionCorta: "Servicio técnico, recepción de equipos, diagnóstico y liquidación.",
    pasos: [
      {
        popover: {
          title: "🔧 Servicio Técnico y Reparaciones",
          description: "Registrá la entrada de equipos, asigná repuestos del depósito e indicá el costo de mano de obra.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Estados de la Orden",
          description: "Seguimiento visual: Recibido, En Diagnóstico, Aprobado, Finalizado y Entregado al cliente.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  produccion: {
    id: "produccion",
    nombre: "Producción y Recetas (BOM)",
    ruta: "/produccion",
    icono: "Hammer",
    descripcionCorta: "Fórmulas de fabricación, consumo de materias primas y costeo unitario.",
    pasos: [
      {
        popover: {
          title: "⚙️ Fabricación y Recetas Maestras",
          description: "Definí la lista de materiales e insumos necesarios para fabricar cada producto terminado.",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Explosión Automática de Insumos",
          description: "Al asentar una orden de elaboración, el sistema descuenta automáticamente los insumos consumidos.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },

  configuracion: {
    id: "configuracion",
    nombre: "Configuración, Fiscal y Usuarios",
    ruta: "/configuracion",
    icono: "Settings",
    descripcionCorta: "Puntos de venta ARCA, coeficientes de cobro y permisos por rol.",
    pasos: [
      {
        element: "#tour-configuracion",
        popover: {
          title: "⚙️ Configuración del Comercio",
          description: "Parámetros impositivos, CUIT, certificados de facturación y rubros comerciales habilitados.",
          side: "right",
          align: "start",
          popoverClass: "analitica-tour-popover",
        },
      },
      {
        popover: {
          title: "1️⃣ Roles y Equipo de Trabajo",
          description: "Invitá a tu equipo asignando roles claros: Dueño, Colaborador de caja o Estudio Contable.",
          popoverClass: "analitica-tour-popover",
        },
      },
    ],
  },
};

/**
 * Mapeo de slugs de guías hacia claves de tours en Driver.js.
 */
export const GUIA_A_TOUR_MAP: Record<string, string> = {
  "indice-general": "general",
  "primeros-pasos": "general",
  "roles-y-equipo": "configuracion",
  "dashboard-inicio": "general",
  "copilot-ia": "copilot",
  "punto-de-venta": "ventas",
  "clientes-y-cuentas-corrientes": "clientes",
  "pedidos-y-despachos": "pedidos",
  "agenda-de-turnos": "agenda",
  "abonos-y-membresias": "abonos",
  "ordenes-de-trabajo": "ordenes",
  "catalogo-de-productos": "productos",
  "control-de-inventario": "inventario",
  "compras-y-recepcion": "compras",
  "proveedores": "compras",
  "produccion-y-recetas": "produccion",
  "analytics-y-rentabilidad": "analytics",
  "metas-y-objetivos": "analytics",
  "comisiones-de-personal": "ventas",
  "archivo-digital": "general",
  "tienda-online": "general",
  "configuracion-general": "configuracion",
  "suscripcion-y-planes": "general",
  "mesa-de-ayuda": "general",
  "programa-de-referidos": "general",
  "glosario-y-faq": "general",
};

/**
 * Inicia el tour interactivo con Driver.js de un módulo específico.
 */
export function iniciarTourModulo(moduloId: string): void {
  if (typeof window === "undefined") return;

  const def = TOURS_MODULOS[moduloId] || TOURS_MODULOS.general;
  if (!def || !def.pasos || def.pasos.length === 0) return;

  // Filtrar pasos que tengan elementos HTML requeridos pero no presentes en el DOM
  const pasosFiltrados = def.pasos.filter((p) => {
    if (!p.element) return true;
    const el = typeof p.element === "string" ? document.querySelector(p.element) : p.element;
    return Boolean(el);
  });

  const pasosFinales = pasosFiltrados.length > 0 ? pasosFiltrados : def.pasos;

  const config: Config = {
    showProgress: true,
    animate: true,
    allowClose: true,
    nextBtnText: "Siguiente paso →",
    prevBtnText: "← Anterior",
    doneBtnText: "¡Excelente, comenzar!",
    progressText: "{{current}} de {{total}}",
    steps: pasosFinales,
    onDestroyStarted: () => {
      marcarTourCompletado();
    },
  };

  const driverObj = driver(config);
  driverObj.drive();
}

/**
 * Inicia el tour general de bienvenida de Analítica 360.
 */
export function iniciarTourAnalitica360(forzar = false): void {
  if (typeof window === "undefined") return;

  if (!forzar && haVistoTour()) {
    return;
  }

  iniciarTourModulo("general");
}

// Helper global accesible desde la consola del navegador
if (typeof window !== "undefined") {
  (window as unknown as { iniciarTour?: (moduloOForzar?: string | boolean) => void }).iniciarTour = (arg = "general") => {
    if (typeof arg === "string") {
      iniciarTourModulo(arg);
    } else {
      iniciarTourAnalitica360(Boolean(arg));
    }
  };
}
