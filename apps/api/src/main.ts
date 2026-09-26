import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // apps/web llama a esta API directo desde el navegador con el JWT de Clerk:
  // solo se aceptan los orígenes configurados (local por defecto; en producción, el dominio).
  const origenes = config.get('CORS_ORIGINS', { infer: true }).split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origenes, credentials: true });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
