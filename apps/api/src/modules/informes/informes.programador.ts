import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { InformesService } from './informes.service.js';

/** Cada cuánto se fija si toca mandar informes (el envío en sí es una vez por período). */
const CADA_MS = 10 * 60_000;

/**
 * Programador de los informes por email: cada 10 minutos mira si cerró una
 * semana o un mes y manda lo que falte. Es seguro con varias instancias (cada
 * envío se reserva en la base) y se apaga con INFORMES_AUTOMATICOS=0.
 */
@Injectable()
export class InformesProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Informes');
  private timers: NodeJS.Timeout[] = [];
  private corriendo = false;

  constructor(
    private readonly informes: InformesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('INFORMES_AUTOMATICOS', { infer: true }) === '0' || process.env.VITEST) return;
    this.timers = [setInterval(() => void this.vuelta(), CADA_MS), setTimeout(() => void this.vuelta(), 60_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }

  private async vuelta() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      const n = await this.informes.ciclo();
      if (n) this.logger.log(`Informes procesados: ${n}`);
    } catch (e) {
      this.logger.error(`Programador de informes: ${(e as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }
}
