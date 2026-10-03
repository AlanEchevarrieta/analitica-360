import { z } from 'zod';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

export const auditoriaQuerySchema = z.object({
  desde: fecha,
  hasta: fecha,
  actorUsuarioId: z.string().uuid().optional(),
  entidad: z.string().max(40).optional(),
  accion: z.enum(['crear', 'editar', 'borrar', 'restaurar', 'anular']).optional(),
  busqueda: z.string().trim().max(100).optional(),
  /** Solo en la consola. */
  empresaId: z.string().uuid().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(50),
});
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
