import { z } from 'zod';

export const serieHomeQuerySchema = z.object({
  dias: z.coerce.number().refine((n): n is 7 | 30 | 90 => n === 7 || n === 30 || n === 90, {
    message: 'dias debe ser 7, 30 o 90',
  }).default(90),
});
export type SerieHomeQuery = z.infer<typeof serieHomeQuerySchema>;
