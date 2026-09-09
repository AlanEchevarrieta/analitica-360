import type { SupabaseClient } from '@supabase/supabase-js'

export type PlanCantidad = { plan: string; cantidad: number }

export type AdminSaasMetrics = {
  mrr: number
  totalEmpresas: number
  activas: number
  enPrueba: number
  vencidas: number
  nuevasEsteMes: number
  nuevasMesAnterior: number
  pagosEsteMes: number
  empresasPorPlan: PlanCantidad[]
}

export type AdminPagoFila = {
  id: string
  empresa_id: string
  empresa_nombre: string
  monto_ars: number
  metodo: string
  estado: string
  periodo: string | null
  notas: string | null
  created_at: string
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const METRICS_VACIAS: AdminSaasMetrics = {
  mrr: 0,
  totalEmpresas: 0,
  activas: 0,
  enPrueba: 0,
  vencidas: 0,
  nuevasEsteMes: 0,
  nuevasMesAnterior: 0,
  pagosEsteMes: 0,
  empresasPorPlan: [],
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data == null) return {}
  if (typeof data === 'string') {
    try {
      return asRecord(JSON.parse(data) as unknown)
    } catch (err) {
      console.error('[admin_saas_metrics] JSON inválido', err, data)
      return {}
    }
  }
  if (Array.isArray(data)) return asRecord(data[0])
  if (typeof data === 'object') return data as Record<string, unknown>
  return {}
}

function mapMetrics(data: unknown): AdminSaasMetrics {
  const row = asRecord(data)
  const planes = Array.isArray(row.empresas_por_plan) ? row.empresas_por_plan : []
  return {
    mrr: num(row.mrr),
    totalEmpresas: num(row.total_empresas),
    activas: num(row.activas),
    enPrueba: num(row.en_prueba),
    vencidas: num(row.vencidas),
    nuevasEsteMes: num(row.nuevas_este_mes),
    nuevasMesAnterior: num(row.nuevas_mes_anterior),
    pagosEsteMes: num(row.pagos_este_mes),
    empresasPorPlan: planes.map((item) => {
      const p = item as Record<string, unknown>
      return { plan: String(p.plan ?? ''), cantidad: num(p.cantidad) }
    }),
  }
}

export async function cargarAdminSaasMetrics(
  client: SupabaseClient,
): Promise<{ data: AdminSaasMetrics; error: string | null }> {
  const { data, error } = await client.rpc('admin_saas_metrics')
  if (error) {
    console.error('[admin_saas_metrics]', error)
    const t = error.message.toLowerCase()
    if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
      return {
        data: METRICS_VACIAS,
        error: 'Falta el SQL de métricas. Pegá supabase/028_saas_metrics.sql (rol postgres) y recargá.',
      }
    }
    return { data: METRICS_VACIAS, error: error.message }
  }
  return { data: mapMetrics(data), error: null }
}

export async function listarPagosAdmin(
  client: SupabaseClient,
  input: { estado: string; periodo: string },
): Promise<{ filas: AdminPagoFila[]; error: string | null }> {
  const periodo = input.periodo.trim() ? `${input.periodo}-01` : null
  const { data, error } = await client.rpc('admin_listar_pagos', {
    p_estado: input.estado || null,
    p_periodo: periodo,
  })
  if (error) {
    console.error('[admin_listar_pagos]', error)
    return { filas: [], error: error.message }
  }
  return {
    filas: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      empresa_id: String(row.empresa_id),
      empresa_nombre: String(row.empresa_nombre ?? ''),
      monto_ars: num(row.monto_ars),
      metodo: String(row.metodo ?? ''),
      estado: String(row.estado ?? ''),
      periodo: row.periodo == null ? null : String(row.periodo).slice(0, 7),
      notas: row.notas == null ? null : String(row.notas),
      created_at: String(row.created_at ?? ''),
    })),
    error: null,
  }
}

export async function registrarPagoAdmin(
  client: SupabaseClient,
  input: {
    empresaId: string
    monto: number
    metodo: string
    periodo: string
    notas: string
  },
): Promise<string | null> {
  const { error } = await client.rpc('admin_registrar_pago', {
    p_empresa_id: input.empresaId,
    p_monto: input.monto,
    p_metodo: input.metodo,
    p_periodo: `${input.periodo}-01`,
    p_notas: input.notas,
  })
  if (!error) return null
  console.error('[admin_registrar_pago]', error)
  if (error.message.includes('MONTO_INVALIDO')) return 'El monto tiene que ser mayor a 0'
  return error.message
}
