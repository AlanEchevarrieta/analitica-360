"use client";

import { PLANES, planMinimoPara, type PlanPagoId } from "@analitica360/shared-types";
import { useSuscripcion } from "./use-suscripcion";

/** Etiqueta de cada función de plan, para los avisos de "mejorá tu plan". */
export const NOMBRE_FUNCION: Record<string, string> = {
  analytics: "Analytics",
  insights: "Insights (pronósticos y combos)",
  contabilidad: "Contabilidad y estados contables",
  pedidos: "Pedidos con preparación y remitos",
  produccion: "Producción (recetas, fabricación y kits)",
  listas_precios: "Listas de precios",
  cuenta_corriente: "Cuenta corriente de clientes",
  difusiones: "Segmentos y difusiones",
  importar: "Importar desde Excel",
  auditoria: "Bitácora de auditoría",
  tienda: "Tienda online",
};

/**
 * Lo que incluye el plan de la empresa (GET /suscripcion → plan). Mientras carga,
 * todo cuenta como incluido para no mostrar candados de más: la API igual controla.
 */
export function usePlan() {
  const { data, isPending, isError } = useSuscripcion();
  const plan = data?.plan;
  return {
    cargado: Boolean(plan),
    /** Ya se sabe el plan (o falló el pedido y se deja pasar: la API igual controla). */
    listo: Boolean(plan) || (isError && !isPending),
    plan,
    incluye: (funcion: string) => !plan || plan.funciones.includes(funcion),
    /** Para habilitar consultas: solo cuando ya se sabe que el plan la incluye (así no se piden datos que la API va a rechazar). */
    disponible: (funcion: string) => Boolean(plan?.funciones.includes(funcion)),
    planMinimo: (funcion: string): { id: PlanPagoId; nombre: string } => {
      const id = planMinimoPara(funcion);
      return { id, nombre: PLANES[id].nombre };
    },
  };
}
