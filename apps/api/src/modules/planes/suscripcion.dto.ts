import { z } from 'zod';
import { ESTADOS_SUSCRIPCION, type EstadoSuscripcion } from './suscripcion.repository.js';

const estadoValues = ESTADOS_SUSCRIPCION as [EstadoSuscripcion, ...EstadoSuscripcion[]];
const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

export const marcarDemoSchema = z.object({ esDemo: z.boolean() });
export type MarcarDemoDto = z.infer<typeof marcarDemoSchema>;

export const asignarSuscripcionSchema = z.object({
  empresaId: z.string().uuid(),
  planId: z.string().uuid(),
  fechaVencimiento: fechaIso,
});
export type AsignarSuscripcionDto = z.infer<typeof asignarSuscripcionSchema>;

export const cambiarEstadoSuscripcionSchema = z.object({ estado: z.enum(estadoValues) });
export type CambiarEstadoSuscripcionDto = z.infer<typeof cambiarEstadoSuscripcionSchema>;
