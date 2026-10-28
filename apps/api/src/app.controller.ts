import { Controller, Get, Header } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

@Controller()
export class AppController {
  private widgetJsCache: string | null = null;

  constructor(private readonly appService: AppService) {}

  // Healthcheck simple, sin auth.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Sirve el bundle JavaScript del widget embeddable oficial de Analítica 360
   * para inclusión en sitios web de terceros (WordPress, Wix, HTML, etc.).
   */
  @Public()
  @Get(['widget.js', 'tienda/widget.js'])
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getWidget(): string {
    if (this.widgetJsCache) return this.widgetJsCache;
    const posiblesRutas = [
      resolve(process.cwd(), '../../packages/sdk/dist/widget.standalone.js'),
      resolve(process.cwd(), '../packages/sdk/dist/widget.standalone.js'),
      resolve(process.cwd(), 'packages/sdk/dist/widget.standalone.js'),
      resolve(process.cwd(), 'public/widget.js'),
    ];
    for (const r of posiblesRutas) {
      if (existsSync(r)) {
        this.widgetJsCache = readFileSync(r, 'utf-8');
        return this.widgetJsCache;
      }
    }
    return '/* Analitica360 Widget no disponible */';
  }
}
