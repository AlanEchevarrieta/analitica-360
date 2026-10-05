import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { BajasService } from './bajas.service.js';

/** Cada hora: borra las cuentas cuyo plazo para arrepentirse ya terminó. */
@Injectable()
export class BajasProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Bajas');
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly bajas: BajasService) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    const vuelta = () =>
      void this.bajas
        .ejecutarVencidas()
        .then((n) => n && this.logger.log(`Cuentas borradas: ${n}`))
        .catch((e) => this.logger.error((e as Error).message));
    this.timers = [setTimeout(vuelta, 90_000), setInterval(vuelta, 3600_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
