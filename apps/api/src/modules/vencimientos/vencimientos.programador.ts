import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { VencimientosService } from './vencimientos.service.js';

/** Cada 6 horas: si el dólar o los topes del monotributo se atrasaron, avisa a los administradores. */
@Injectable()
export class VencimientosProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Vencimientos');
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly vencimientos: VencimientosService) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    const vuelta = () => void this.vencimientos.revisar().catch((e) => this.logger.error((e as Error).message));
    // La primera vuelta espera a que la sincronización del dólar del arranque termine.
    this.timers = [setTimeout(vuelta, 10 * 60_000), setInterval(vuelta, 6 * 3600_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
