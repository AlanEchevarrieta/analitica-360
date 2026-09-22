import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY es obligatoria'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // La firma svix del webhook de Clerk se verifica en apps/web (que es
  // quien recibe el request público de Clerk); este backend solo confía en
  // el reenvío interno si trae este secreto compartido (ver
  // POST /internal/clerk-webhook en UsuariosModule).
  INTERNAL_WEBHOOK_SECRET: z.string().min(1, 'INTERNAL_WEBHOOK_SECRET es obligatoria'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}
