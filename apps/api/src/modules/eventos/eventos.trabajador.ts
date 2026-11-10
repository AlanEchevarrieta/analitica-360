import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { EventosService } from './eventos.service.js';

const CADA_MS = 15_000;
const LIMPIEZA_CADA_MS = 24 * 3_600_000;

/**
 * Trabajador en segundo plano de la cola de eventos:
 * - Cada 15 segundos toma hasta 20 eventos pendientes (`FOR UPDATE SKIP LOCKED`) y los procesa.
 * - Una vez por día limpia los eventos `hecho` de más de 30 días y los `fallo`/`descartado` de más de 90 días.
 * - Se apaga con `EVENTOS_TRABAJADOR=0` o en `VITEST`.
 */
@Injectable()
export class EventosTrabajador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('EventosTrabajador');
  private timers: NodeJS.Timeout[] = [];
  private corriendo = false;

  constructor(
    private readonly eventos: EventosService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('EVENTOS_TRABAJADOR', { infer: true }) === '0' || process.env.VITEST) return;
    this.timers = [
      setInterval(() => void this.vuelta(), CADA_MS),
      setTimeout(() => void this.vuelta(), 5_000),
      setInterval(() => void this.limpiar(), LIMPIEZA_CADA_MS),
      setTimeout(() => void this.limpiar(), 5 * 60_000),
    ];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }

  private async vuelta() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      const n = await this.eventos.procesarCiclo();
      if (n > 0) this.logger.log(`Eventos procesados en este ciclo: ${n}`);
    } catch (e) {
      this.logger.error(`Error en ciclo de eventos: ${(e as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }

  private async limpiar() {
    try {
      const { hechos, fallos } = await this.eventos.limpiarAntiguos();
      if (hechos || fallos) {
        this.logger.log(`Limpieza de eventos antiguos: ${hechos} hechos (>30d), ${fallos} fallos/descartados (>90d)`);
      }
    } catch (e) {
      this.logger.error(`Error limpiando eventos antiguos: ${(e as Error).message}`);
    }
  }
}
