export interface PlanCantidad {
  plan: string;
  cantidad: number;
}

export interface AdminSaasMetrics {
  mrr: number;
  totalEmpresas: number;
  activas: number;
  enPrueba: number;
  vencidas: number;
  nuevasEsteMes: number;
  nuevasMesAnterior: number;
  pagosEsteMes: number;
  empresasPorPlan: PlanCantidad[];
}

export interface AdminCapacidad {
  ventas: number;
  productos: number;
  clientes: number;
  movimientos: number;
  empresas: number;
  totalRegistros: number;
  registrosUltimoMes: number;
}

export interface AdminPago {
  id: string;
  empresaId: string;
  empresaNombre: string;
  montoArs: number;
  metodo: string;
  estado: string;
  periodo: string | null;
  notas: string | null;
  createdAt: string;
}

export interface RegistrarPagoInput {
  empresaId: string;
  monto: number;
  metodo: string;
  /** YYYY-MM - se trunca al primer día del mes, igual que el SQL real. */
  periodo: string;
  notas: string | null;
}

export type ResultadoPago = { ok: true; id: string } | { ok: false; motivo: 'empresa_invalida' | 'monto_invalido' | 'metodo_invalido' };

export const ADMIN_SAAS_REPOSITORY = Symbol('ADMIN_SAAS_REPOSITORY');

/**
 * Puerto fiel de src/lib/adminSaaS.ts, cross-tenant (gateado por
 * @RequireAdminApp() en el controller, no acá). Última definición de cada
 * función SQL real:
 * - metrics(): admin_saas_metrics() (028_saas_metrics.sql).
 * - listarPagos()/registrarPago(): admin_listar_pagos()/admin_registrar_pago()
 *   (025_admin_saas.sql, única definición de cada una).
 * - capacidad(): admin_capacidad() (044_admin_capacidad.sql). El SQL real
 *   también devuelve `tablas` (tamaño en disco por tabla, vía pg_tables/
 *   pg_total_relation_size) - no se porta: ni el propio mapeo del legacy
 *   (cargarAdminCapacidad) lee ese campo, es diagnóstico de infraestructura
 *   sin ningún consumidor real.
 */
export interface AdminSaasRepository {
  metrics(): Promise<AdminSaasMetrics>;
  capacidad(): Promise<AdminCapacidad>;
  listarPagos(estado: string | null, periodo: string | null): Promise<AdminPago[]>;
  registrarPago(input: RegistrarPagoInput): Promise<ResultadoPago>;
}
