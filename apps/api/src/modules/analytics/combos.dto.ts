import { z } from 'zod';

export const combosQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(10),
});
export type CombosQuery = z.infer<typeof combosQuerySchema>;
