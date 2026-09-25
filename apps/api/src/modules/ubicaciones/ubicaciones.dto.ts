import { z } from 'zod';
import { booleanQuery } from '../../common/zod/boolean-query.js';

export const tipoUbicacionSchema = z.enum(['deposito', 'local', 'stand', 'feria', 'otro']);

export const guardarUbicacionSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().trim().nullable().optional(),
  tipo: tipoUbicacionSchema.default('otro'),
  activo: z.boolean().default(true),
});
export type GuardarUbicacionInput = z.infer<typeof guardarUbicacionSchema>;

export const listarUbicacionesQuerySchema = z.object({
  soloActivas: booleanQuery(true),
});
export type ListarUbicacionesQuery = z.infer<typeof listarUbicacionesQuerySchema>;
