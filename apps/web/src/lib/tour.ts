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

/**
 * Pasos del tour interactivo de Analítica 360 guiados por Driver.js.
 */
export function obtenerPasosTour(): DriveStep[] {
  const pasosTodos: DriveStep[] = [
    {
      // Paso 1: Bienvenida centrada (sin element requerido, aparece siempre como modal)
      popover: {
        title: "🚀 Bienvenido a Analítica 360",
        description:
          "Te preparamos una breve guía de 1 minuto para que conozcas las funciones clave de tu nuevo sistema comercial, contable y financiero.",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-inicio",
      popover: {
        title: "🏠 Panel de Inicio",
        description:
          "Tu centro de operaciones en tiempo real: facturación del día, compras, punto de equilibrio, metas y resumen de productos líderes.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-copilot",
      popover: {
        title: "✨ Copilot IA (Analítica 360 Inteligencia de Negocios)",
        description:
          "Tu CFO y consultor inteligente. Analiza en tiempo real correlaciones no visibles en dashboards: afinidad de canasta (combos de venta cruzada), clientes en riesgo de abandono y fugas de rentabilidad en cuotas.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-ventas",
      popover: {
        title: "💳 Ventas y Caja Rápida",
        description:
          "Cobrá y emití comprobantes en segundos. Soporta múltiples formas de pago, recargos automáticos por cuotas, señas y ventas en cuenta corriente con seguimiento de saldos.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-productos",
      popover: {
        title: "📦 Catálogo, Precios y Stock",
        description:
          "Control de inventario en tiempo real, múltiples listas de precios y costos de reposición. Podés actualizar tus productos de forma masiva desde plantillas Excel en segundos.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-analytics",
      popover: {
        title: "📊 Analytics & Rentabilidad Real",
        description:
          "Conocé con precisión tu margen bruto real, punto de equilibrio operativo y evolución de ventas para tomar decisiones estratégicas con números concretos.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-empresa",
      popover: {
        title: "🏢 Selector de Empresa y Sucursales",
        description:
          "¿Gestionás más de un negocio o sucursal? Cambiá de organización al instante sin cerrar sesión, manteniendo los datos contables y de inventario 100% aislados.",
        side: "bottom",
        align: "end",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-configuracion",
      popover: {
        title: "⚙️ Configuración, Medios de Pago y Equipo",
        description:
          "Configurá tus datos fiscales (Monotributo/IVA), coeficientes de tarjetas e invitá a tus colaboradores con permisos específicos para sus puestos.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
  ];

  // Si estamos en navegador, filtramos pasos que requieran un elemento que no exista en el DOM
  if (typeof document !== "undefined") {
    return pasosTodos.filter((p) => {
      if (!p.element) return true;
      const el = typeof p.element === "string" ? document.querySelector(p.element) : p.element;
      return Boolean(el);
    });
  }

  return pasosTodos;
}

/**
 * Inicia el tour interactivo con Driver.js.
 * @param forzar Si es true, inicia el tour incluso si el usuario ya lo completó anteriormente.
 */
export function iniciarTourAnalitica360(forzar = false): void {
  if (typeof window === "undefined") return;

  if (!forzar && haVistoTour()) {
    return;
  }

  const pasos = obtenerPasosTour();
  if (pasos.length === 0) return;

  const config: Config = {
    showProgress: true,
    animate: true,
    allowClose: true,
    nextBtnText: "Siguiente →",
    prevBtnText: "← Anterior",
    doneBtnText: "¡Empezar a usar Analítica 360!",
    progressText: "{{current}} de {{total}}",
    steps: pasos,
    onDestroyStarted: () => {
      marcarTourCompletado();
    },
  };

  const driverObj = driver(config);
  driverObj.drive();
}

// Helper global accesible desde la consola del navegador para debug rápido
if (typeof window !== "undefined") {
  (window as unknown as { iniciarTour?: (forzar?: boolean) => void }).iniciarTour = (forzar = true) => {
    iniciarTourAnalitica360(forzar);
  };
}
