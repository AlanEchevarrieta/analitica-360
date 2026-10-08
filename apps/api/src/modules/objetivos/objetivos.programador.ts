import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ObjetivosService } from './objetivos.service.js';

/** Cada 6 horas: avisa los objetivos que a este ritmo no llegan (una vez por período y persona). */
@Injectable()
export class ObjetivosProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Objetivos');
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly objetivos: ObjetivosService) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    const vuelta = () =>
      void this.objetivos
        .revisarAvisos()
        .then((n) => n && this.logger.log(`Avisos de objetivos: ${n}`))
        .catch((e) => this.logger.error((e as Error).message));
    this.timers = [setTimeout(vuelta, 15 * 60_000), setInterval(vuelta, 6 * 3600_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
