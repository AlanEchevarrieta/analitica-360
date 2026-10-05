import { Inject, Injectable } from '@nestjs/common';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { accesoCuenta, type AccesoCuenta } from './acceso-cuenta.util.js';
import { PLANES, planEfectivo, type PlanId } from './planes.util.js';
import { SUSCRIPCION_REPOSITORY, type SuscripcionRepository } from './suscripcion.repository.js';

/** Corre en cada request (SuscripcionGuard): se guarda unos segundos por empresa. */
const TTL_MS = 30_000;

/** Lo que el plan le permite a una empresa (ver PlanGuard). */
export interface PlanEmpresa {
  /** El plan que rige: el contratado, o Pro durante la prueba. Las empresas demo, todo (ecommerce). */
  plan: PlanId;
  contratado: string | null;
  enPrueba: boolean;
  funciones: readonly string[];
  maxUsuarios: number | null;
  maxUbicaciones: number | null;
  ubicaciones: number;
  /** Usuarios que entran en el límite del plan (dueños primero). */
  usuariosHabilitados: ReadonlySet<string>;
  usuariosTotales: number;
}

@Injectable()
export class AccesoCuentaService {
  private readonly cache = new Map<string, { valor: AccesoCuenta; vence: number }>();
  private readonly cachePlan = new Map<string, { valor: PlanEmpresa; vence: number }>();

  constructor(@Inject(SUSCRIPCION_REPOSITORY) private readonly repository: SuscripcionRepository) {}

  async de(empresaId: string): Promise<AccesoCuenta> {
    const guardado = this.cache.get(empresaId);
    if (guardado && guardado.vence > Date.now()) return guardado.valor;
    const { esDemo, suscripcion } = await this.repository.datosAcceso(empresaId);
    const valor = accesoCuenta(suscripcion, esDemo, fechaHoyAR());
    this.cache.set(empresaId, { valor, vence: Date.now() + TTL_MS });
    return valor;
  }

  async planDe(empresaId: string): Promise<PlanEmpresa> {
    const guardado = this.cachePlan.get(empresaId);
    if (guardado && guardado.vence > Date.now()) return guardado.valor;
    const d = await this.repository.datosPlan(empresaId);
    const plan: PlanId = d.esDemo ? 'ecommerce' : planEfectivo(d.plan, d.enPrueba);
    const def = PLANES[plan];
    const valor: PlanEmpresa = {
      plan,
      contratado: d.plan,
      enPrueba: d.enPrueba,
      funciones: def.funciones,
      maxUsuarios: def.maxUsuarios,
      maxUbicaciones: def.maxUbicaciones,
      ubicaciones: d.ubicaciones,
      usuariosHabilitados: new Set(def.maxUsuarios == null ? d.usuarios : d.usuarios.slice(0, def.maxUsuarios)),
      usuariosTotales: d.usuarios.length,
    };
    this.cachePlan.set(empresaId, { valor, vence: Date.now() + TTL_MS });
    return valor;
  }

  /** Tras un cambio del admin (asignar plan, cambiar estado, demo), para que rija al instante. */
  olvidar(empresaId?: string): void {
    if (empresaId) {
      this.cache.delete(empresaId);
      this.cachePlan.delete(empresaId);
    } else {
      this.cache.clear();
      this.cachePlan.clear();
    }
  }
}
