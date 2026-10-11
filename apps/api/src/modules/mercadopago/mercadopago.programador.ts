import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { MercadoPagoService } from './mercadopago.service.js';

/** Cada 6 horas: si cambió el precio del próximo período (aumento por IPC), actualiza el monto del débito automático. */
@Injectable()
export class MercadoPagoProgramador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('MercadoPago');
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly mercadoPago: MercadoPagoService) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    const vuelta = () =>
      void this.mercadoPago
        .actualizarMontos()
        .then((n) => n && this.logger.log(`Débitos con monto nuevo: ${n}`))
        .catch((e) => this.logger.error((e as Error).message));
    this.timers = [setTimeout(vuelta, 15 * 60_000), setInterval(vuelta, 6 * 3600_000)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
