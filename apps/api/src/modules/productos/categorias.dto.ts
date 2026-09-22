import { z } from 'zod';

export const guardarCategoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().trim().nullable().optional(),
  activo: z.boolean().default(true),
});
export type GuardarCategoriaInput = z.infer<typeof guardarCategoriaSchema>;

export const listarCategoriasQuerySchema = z.object({
  soloActivas: z.coerce.boolean().default(false),
});
export type ListarCategoriasQuery = z.infer<typeof listarCategoriasQuerySchema>;
