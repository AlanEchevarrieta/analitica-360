import { SetMetadata } from '@nestjs/common';
import type { Funcion } from '../../modules/planes/planes.util.js';

export const FUNCION_PLAN_KEY = 'funcionPlan';

/**
 * Requiere que el plan de la empresa incluya esta función (ej. 'tienda',
 * 'listas_precios'). Los módulos con @RequireModulo ya se controlan contra el
 * plan solos; esto es para lo que no es un módulo entero. Ver PlanGuard.
 */
export const RequireFuncion = (funcion: Funcion) => SetMetadata(FUNCION_PLAN_KEY, funcion);
