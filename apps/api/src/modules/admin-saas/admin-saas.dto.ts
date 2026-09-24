import { z } from 'zod';

const periodoYYYYMM = z.string().regex(/^\d{4}-\d{2}$/, 'Formato de período inválido (YYYY-MM)');

export const listarPagosQuerySchema = z.object({
  estado: z.string().trim().default(''),
  periodo: z.union([periodoYYYYMM, z.literal('')]).default(''),
});
export type ListarPagosQuery = z.infer<typeof listarPagosQuerySchema>;

export const registrarPagoSchema = z.object({
  empresaId: z.string().uuid(),
  monto: z.number().positive(),
  metodo: z.string().trim().min(1),
  periodo: periodoYYYYMM,
  notas: z.string().trim().default(''),
});
export type RegistrarPagoDto = z.infer<typeof registrarPagoSchema>;
