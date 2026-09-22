import { z } from 'zod';

export const guardarAtributoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  valores: z.array(z.string().trim().min(1)).min(1, 'Agregá al menos un valor'),
  activoVentas: z.boolean().default(true),
});
export type GuardarAtributoInput = z.infer<typeof guardarAtributoSchema>;
