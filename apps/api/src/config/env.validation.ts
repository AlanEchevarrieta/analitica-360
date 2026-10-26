import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  /** Orígenes web que pueden llamar a la API, separados por coma (ej. https://analitica360.app,https://www.analitica360.app). */
  CORS_ORIGINS: z.string().default('http://localhost:4001'),
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
  // Secreto para los códigos de ingreso de las cuentas de las tiendas (si falta, usa INTERNAL_WEBHOOK_SECRET).
  TIENDA_SESIONES_SECRETO: z.string().min(16).optional(),
  // Ingreso con Google en las tiendas: el Client ID de Google Cloud (OAuth). Sin esto, solo código por email.
  GOOGLE_CLIENT_ID_TIENDAS: z.string().min(10).optional(),
  // SOLO entorno local (Docker de desarrollo): sin Resend, el código de ingreso va al log en vez de por email.
  // En producción no se define: sin Resend, el ingreso por email responde 503.
  CODIGOS_INGRESO_EN_LOG: z.enum(['0', '1']).default('0'),
  // Aviso por email de registros nuevos (opcional; sin esto el aviso queda solo
  // en la consola de administración). Resend: resend.com, plan gratis.
  RESEND_API_KEY: z.string().min(1).optional(),
  /** A quién avisar (si falta, a los emails de admin_emails). */
  AVISOS_EMAIL: z.string().optional(),
  /** Remitente verificado en Resend (ej. avisos@analitica360.app). */
  /** Carpeta de fotos y logos (desarrollo). */
  ARCHIVOS_DIR: z.string().optional(),
  /** Documentos privados del archivo (no se publican en /archivos). Por defecto ./uploads-privados. */
  ARCHIVOS_PRIVADOS_DIR: z.string().optional(),
  /** URL pública de esa carpeta (por defecto http://localhost:PORT/archivos). */
  ARCHIVOS_URL_PUBLICA: z.string().optional(),
  /** Dominio de las tiendas: <subdominio>.<este dominio>. */
  TIENDA_DOMINIO_BASE: z.string().default('analitica360.app'),
  AVISOS_EMAIL_DESDE: z.string().default('Analítica 360 <onboarding@resend.dev>'),
  /** URL pública de esta API (para los links de baja de los informes por email). Por defecto http://localhost:PORT. */
  API_URL_PUBLICA: z.string().url().optional(),
  /** Detrás de un proxy (Caddy): a quién creerle la IP del visitante. Ej. uniquelocal (la red interna de Docker). */
  TRUST_PROXY: z.string().optional(),
  /** Pedidos por minuto por cliente (600 por defecto; 0 = sin límite, ej. para la prueba de carga local). */
  LIMITE_PEDIDOS_POR_MINUTO: z.coerce.number().int().min(0).default(600),
  /** Mercado Pago (suscripciones de Analítica 360): Access Token de la aplicación. Sin esto, el débito automático no se ofrece. */
  MP_ACCESS_TOKEN: z.string().min(10).optional(),
  /** Clave secreta de los webhooks de Mercado Pago (Tus integraciones → Webhooks). Sin esto, los avisos se rechazan. */
  MP_WEBHOOK_SECRET: z.string().min(8).optional(),
  /** Mercado Pago en las tiendas (OAuth): Client ID y Client Secret de la misma aplicación. Sin esto, las tiendas no ofrecen Mercado Pago. */
  MP_CLIENT_ID: z.string().min(4).optional(),
  MP_CLIENT_SECRET: z.string().min(8).optional(),
  /** URL pública de la app (adonde vuelve el cliente después de autorizar el pago). */
  APP_URL_PUBLICA: z.string().url().default('http://localhost:4001'),
  /** Clave para cifrar secretos de terceros en la base (32 bytes en base64: openssl rand -base64 32). Sin esto, no se pueden conectar envíos. */
  CLAVE_CIFRADO: z.string().min(40).optional(),
  /** API de Zipnova (envíos). Se cambia solo para pruebas. */
  ZIPNOVA_URL: z.string().url().default('https://api.zipnova.com.ar/v2'),
  /** ARCA (factura electrónica): CUIT de Analítica 360 como proveedor, al que cada empresa delega el servicio "wsfe". */
  ARCA_CUIT: z.string().regex(/^\d{11}$/, 'ARCA_CUIT: 11 dígitos sin guiones').optional(),
  /** Certificado (PEM, o el PEM en base64) que emite ARCA para ese CUIT. */
  ARCA_CERTIFICADO: z.string().min(50).optional(),
  /** Clave privada (PEM, o en base64) con la que se generó el pedido del certificado. Secreta. */
  ARCA_CLAVE: z.string().min(50).optional(),
  /** homologacion (pruebas de ARCA) o produccion. */
  ARCA_AMBIENTE: z.enum(['homologacion', 'produccion']).default('homologacion'),
  /** Para cambiar las direcciones de ARCA sin tocar el código (si ARCA las muda). */
  ARCA_URL_WSAA: z.string().url().optional(),
  ARCA_URL_WSFE: z.string().url().optional(),
  /** Informes semanales y mensuales por email: '0' apaga el programador (ej. en una segunda instancia o en pruebas). */
  INFORMES_AUTOMATICOS: z.enum(['0', '1']).default('1'),
  /** Copilot IA: API Key de OpenAI o proveedor LLM compatible (opcional) */
  OPENAI_API_KEY: z.string().optional(),
  COPILOT_API_KEY: z.string().optional(),
  COPILOT_API_URL: z.string().url().optional(),
  COPILOT_MODEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  // Una variable definida pero vacía (ej. `RESEND_API_KEY=` en docker-compose)
  // cuenta como no configurada: así las opcionales toman su valor por defecto.
  const sinVacias = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(sinVacias);
  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}
