import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AlmacenArchivosService } from './common/archivos/almacen-archivos.service.js';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Cabeceras de seguridad (nosniff, sin iframes ajenos, HSTS…) y sin anunciar Express.
  // Las fotos de /archivos/ las muestran la web y las tiendas desde otro origen: cross-origin.
  app.disable('x-powered-by');
  // La API solo devuelve JSON y fotos: su CSP no permite nada (ZAP marcaba la de helmet por amplia).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    }),
  );
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // apps/web llama a esta API directo desde el navegador con el JWT de Clerk:
  // solo se aceptan los orígenes configurados (local por defecto; en producción, el dominio).
  const origenes = config.get('CORS_ORIGINS', { infer: true }).split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origenes, credentials: true });

  // Fotos de productos y logos (públicos). En producción los sirve el almacenamiento externo.
  app.useStaticAssets(AlmacenArchivosService.carpetaLocal(config.get('ARCHIVOS_DIR', { infer: true })), {
    prefix: '/archivos/',
    maxAge: '30d',
    immutable: true,
    index: false,
    dotfiles: 'deny',
  });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
