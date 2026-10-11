import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { PreciosPlanService } from './precios-plan.service.js';

/** Cada 6 horas: manda los avisos de aumento pendientes y deja `planes.precio_ars` con el precio de hoy. */
@Injectable()
export class PreciosPlanProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Precios');
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly precios: PreciosPlanService) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    const vuelta = () =>
      void this.precios
        .avisarPendientes()
        .then(() => this.precios.sincronizarTablaPlanes())
        .catch((e) => this.logger.error((e as Error).message));
    this.timers = [setTimeout(vuelta, 5 * 60_000), setInterval(vuelta, 6 * 3600_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
