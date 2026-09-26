import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  /** Orígenes web que pueden llamar a la API, separados por coma (ej. https://analitica360.app,https://www.analitica360.app). */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY es obligatoria'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // La firma svix del webhook de Clerk se verifica en apps/web (que es
  // quien recibe el request público de Clerk); este backend solo confía en
  // el reenvío interno si trae este secreto compartido (ver
  // POST /internal/clerk-webhook en UsuariosModule).
  INTERNAL_WEBHOOK_SECRET: z.string().min(1, 'INTERNAL_WEBHOOK_SECRET es obligatoria'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  // Clave compartida con las tiendas online para reenviar la IP del cliente
  // (límite de requests por cliente, ver TiendaThrottlerGuard). Opcional.
  TIENDA_PROXY_KEY: z.string().min(16).optional(),
  // Aviso por email de registros nuevos (opcional; sin esto el aviso queda solo
  // en la consola de administración). Resend: resend.com, plan gratis.
  RESEND_API_KEY: z.string().min(1).optional(),
  /** A quién avisar (si falta, a los emails de admin_emails). */
  AVISOS_EMAIL: z.string().optional(),
  /** Remitente verificado en Resend (ej. avisos@analitica360.app). */
  AVISOS_EMAIL_DESDE: z.string().default('Analítica 360 <onboarding@resend.dev>'),
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
