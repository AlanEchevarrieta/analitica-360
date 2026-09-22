import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // apps/web corre en otro puerto (Next.js dev server) y llama a esta API
  // directo desde el browser con el JWT de Clerk.
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
