import { Inject, Injectable } from '@nestjs/common';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { accesoCuenta, type AccesoCuenta } from './acceso-cuenta.util.js';
import { SUSCRIPCION_REPOSITORY, type SuscripcionRepository } from './suscripcion.repository.js';

/** Corre en cada request (SuscripcionGuard): se guarda unos segundos por empresa. */
const TTL_MS = 30_000;

@Injectable()
export class AccesoCuentaService {
  private readonly cache = new Map<string, { valor: AccesoCuenta; vence: number }>();

  constructor(@Inject(SUSCRIPCION_REPOSITORY) private readonly repository: SuscripcionRepository) {}

  async de(empresaId: string): Promise<AccesoCuenta> {
    const guardado = this.cache.get(empresaId);
    if (guardado && guardado.vence > Date.now()) return guardado.valor;
    const { esDemo, suscripcion } = await this.repository.datosAcceso(empresaId);
    const valor = accesoCuenta(suscripcion, esDemo, fechaHoyAR());
    this.cache.set(empresaId, { valor, vence: Date.now() + TTL_MS });
    return valor;
  }

  /** Tras un cambio del admin (asignar plan, cambiar estado, demo), para que rija al instante. */
  olvidar(empresaId?: string): void {
    if (empresaId) this.cache.delete(empresaId);
    else this.cache.clear();
  }
}
