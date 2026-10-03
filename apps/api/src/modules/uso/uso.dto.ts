import { z } from 'zod';

export const eventosUsoSchema = z.object({
  sesion: z.string().trim().min(1).max(40),
  dispositivo: z.enum(['celular', 'escritorio']).optional(),
  eventos: z
    .array(
      z.object({
        tipo: z.enum(['vista', 'clic']),
        ruta: z.string().max(500),
        objetivo: z.string().max(300).nullish(),
        /** ms desde epoch, en el navegador; se acota a la última hora. */
        en: z.number().int().positive().optional(),
      }),
    )
    .min(1)
    .max(50),
});
export type EventosUsoDto = z.infer<typeof eventosUsoSchema>;

export const usoQuerySchema = z.object({
  dias: z.coerce.number().int().refine((d) => [1, 7, 30, 90].includes(d), 'Período inválido').default(30),
  empresaId: z.string().uuid().optional(),
  /** Incluir a los administradores de la app (por defecto no: ensucian los números). */
  conAdmins: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type UsoQuery = z.infer<typeof usoQuerySchema>;
