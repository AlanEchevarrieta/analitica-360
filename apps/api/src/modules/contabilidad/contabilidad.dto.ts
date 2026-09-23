import { z } from 'zod';

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

export const contabilidadQuerySchema = z
  .object({ desde: fechaIso, hasta: fechaIso })
  .refine((q) => q.hasta >= q.desde, { message: 'PERIODO_INVALIDO', path: ['hasta'] });
export type ContabilidadQuery = z.infer<typeof contabilidadQuerySchema>;
