import type { SuscripcionActiva } from './suscripcion.util.js';

export type EstadoSuscripcion = 'activa' | 'vencida' | 'cancelada' | 'pendiente_pago' | 'periodo_prueba';
export const ESTADOS_SUSCRIPCION: EstadoSuscripcion[] = ['activa', 'vencida', 'cancelada', 'pendiente_pago', 'periodo_prueba'];

export interface PlanAdmin {
  id: string;
  nombre: string;
}

export interface FilaAdminSuscripcion {
  suscripcionId: string | null;
  empresaId: string;
  empresaNombre: string;
  estado: string | null;
  fechaVencimiento: string | null;
  planNombre: string | null;
  planActual: string | null;
  esDemo: boolean;
}

export type ResultadoAdmin = { ok: true } | { ok: false; motivo: 'empresa_invalida' | 'plan_invalido' | 'suscripcion_invalida' };

export const SUSCRIPCION_REPOSITORY = Symbol('SUSCRIPCION_REPOSITORY');

/**
 * Puerto fiel de src/lib/suscripcion.ts, según el SQL real (última
 * definición de cada función):
 * - activa(): mi_suscripcion_activa() (005_banner_y_prueba_faltante.sql) -
 *   "self-healing": si la empresa no tiene ninguna suscripción, le crea un
 *   trial de 14 días sobre el plan 'starter' antes de devolver la fila. Es
 *   una lectura con efecto secundario, fiel al RPC real (no un simple SELECT).
 * - iniciarPrueba(): iniciarPeriodoPrueba() (src/lib/suscripcion.ts, JS
 *   puro, no RPC) - mecanismo EXPLÍCITO separado, normalmente llamado una
 *   vez en el alta de la empresa; no-op si ya existe una suscripción.
 * - admin*: gateadas por @RequireAdminApp() en el controller, no acá.
 *   admin_listar_suscripciones() → 027_empresas_demo.sql (última def.).
 *   admin_asignar_suscripcion() → 015_planes_catalogo.sql (última def.).
 *   admin_marcar_demo() → 027_empresas_demo.sql.
 *   admin_cambiar_estado_suscripcion() → 002_trial_admin.sql (única def.).
 */
export interface SuscripcionRepository {
  activa(empresaId: string): Promise<SuscripcionActiva | null>;
  iniciarPrueba(empresaId: string, usuarioId: string, userAgent: string | null): Promise<void>;

  listarPlanes(): Promise<PlanAdmin[]>;
  listarSuscripciones(): Promise<FilaAdminSuscripcion[]>;
  marcarEmpresaDemo(empresaId: string, esDemo: boolean): Promise<ResultadoAdmin>;
  asignarSuscripcion(empresaId: string, planId: string, fechaVencimiento: string): Promise<ResultadoAdmin>;
  cambiarEstadoSuscripcion(suscripcionId: string, estado: EstadoSuscripcion): Promise<ResultadoAdmin>;
}
