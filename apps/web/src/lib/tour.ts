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
  const pasos: DriveStep[] = [
    {
      element: "#tour-inicio",
      popover: {
        title: "🚀 Bienvenido a Analítica 360",
        description:
          "Tu centro de operaciones financieras y comerciales en tiempo real. Desde acá tenés un panorama general de tu facturación, ventas del día, productos más vendidos y alertas preventivas.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
    {
      element: "#tour-copilot",
      popover: {
        title: "✨ Copilot IA (GPT-6 Luna + Data Lake)",
        description:
          "Tu Director Financiero (CFO) inteligente. Analiza correlaciones invisibles al ojo humano y a los dashboards: combinaciones de productos (combos), clientes en riesgo de abandono y fugas silenciosas de margen en cuotas.",
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
          "Cobrá y facturá en segundos desde cualquier dispositivo. Soporta múltiples formas de pago, recargos por cuotas calculados automáticamente, señas y ventas en cuenta corriente con seguimiento de cobro.",
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
          "Mantené al día tu inventario, múltiples listas de precios y costos de reposición. Podés importar o actualizar tus productos de forma masiva desde plantillas Excel en segundos.",
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
          "Conocé con precisión tu punto de equilibrio, el margen bruto real por producto y la evolución intermensual de tu negocio para tomar decisiones con números concretos.",
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
          "Configurá tus datos fiscales (Monotributo/IVA), coeficientes de cuotas e invitá a tus colaboradores con permisos adaptados a sus funciones.",
        side: "right",
        align: "start",
        popoverClass: "analitica-tour-popover",
      },
    },
  ];

  // Filtramos solo los elementos que estén presentes en el DOM actual
  if (typeof document !== "undefined") {
    return pasos.filter((p) => {
      if (!p.element || typeof p.element !== "string") return true;
      return Boolean(document.querySelector(p.element));
    });
  }

  return pasos;
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
      driverObj.destroy();
    },
  };

  const driverObj = driver(config);
  driverObj.drive();
}
