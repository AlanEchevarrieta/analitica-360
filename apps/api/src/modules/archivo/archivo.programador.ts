import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ArchivoService } from './archivo.service.js';

/** Cada 6 horas: avisa por email los documentos que vencen en 30 o en 7 días. */
@Injectable()
export class ArchivoProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Archivo');
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly archivo: ArchivoService) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    const vuelta = () =>
      void this.archivo
        .avisarVencimientos()
        .then((n) => n && this.logger.log(`Avisos de vencimiento enviados: ${n}`))
        .catch((e) => this.logger.error((e as Error).message));
    this.timers = [setTimeout(vuelta, 20 * 60_000), setInterval(vuelta, 6 * 3600_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
