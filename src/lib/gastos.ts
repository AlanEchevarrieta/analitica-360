import type { SupabaseClient } from '@supabase/supabase-js'

export const CATEGORIAS_GASTO = [
  { id: 'alquiler', icono: '🏠', label: 'Alquiler' },
  { id: 'sueldos', icono: '👥', label: 'Sueldos' },
  { id: 'servicios', icono: '💡', label: 'Servicios' },
  { id: 'marketing', icono: '📢', label: 'Marketing' },
  { id: 'logistica', icono: '🚚', label: 'Logística' },
  { id: 'impuestos', icono: '📋', label: 'Impuestos' },
  { id: 'mantenimiento', icono: '🔧', label: 'Mantenimiento' },
  { id: 'otro', icono: '📦', label: 'Otro' },
] as const

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]['id']
export type FrecuenciaGasto = 'mensual' | 'quincenal' | 'semanal'

export const FRECUENCIAS_GASTO: { id: FrecuenciaGasto; label: string }[] = [
  { id: 'mensual', label: 'Mensual' },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'semanal', label: 'Semanal' },
]

export type GastoFila = {
  id: string
  empresa_id: string
  usuario_id: string | null
  categoria: CategoriaGasto
  descripcion: string
  monto: number
  fecha: string
  recurrente: boolean
  frecuencia: FrecuenciaGasto | null
}

function esCategoria(v: string): v is CategoriaGasto {
  return CATEGORIAS_GASTO.some((c) => c.id === v)
}

function filaGasto(row: Record<string, unknown>): GastoFila | null {
  const cat = String(row.categoria ?? '')
  if (!esCategoria(cat)) return null
  const freq = String(row.frecuencia ?? '')
  const frecuencia: FrecuenciaGasto | null =
    freq === 'mensual' || freq === 'quincenal' || freq === 'semanal' ? freq : null
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    usuario_id: row.usuario_id == null ? null : String(row.usuario_id),
    categoria: cat,
    descripcion: String(row.descripcion ?? ''),
    monto: Number(row.monto ?? 0),
    fecha: String(row.fecha ?? '').slice(0, 10),
    recurrente: Boolean(row.recurrente),
    frecuencia,
  }
}

export function metaCategoria(id: string) {
  return CATEGORIAS_GASTO.find((c) => c.id === id) ?? { id: 'otro' as const, icono: '📦', label: id }
}

export async function listarGastos(
  client: SupabaseClient,
  input: { empresaId: string; desde: string; hasta: string; categoria?: CategoriaGasto | '' },
): Promise<{ filas: GastoFila[]; error: string | null }> {
  let q = client
    .from('gastos')
    .select('id, empresa_id, usuario_id, categoria, descripcion, monto, fecha, recurrente, frecuencia')
    .eq('empresa_id', input.empresaId)
    .is('deleted_at', null)
    .gte('fecha', input.desde)
    .lte('fecha', input.hasta)
    .order('fecha', { ascending: false })
  if (input.categoria) q = q.eq('categoria', input.categoria)
  const { data, error } = await q
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('gastos') || t.includes('schema cache') || t.includes('does not exist')) {
      return {
        filas: [],
        error: 'Falta la tabla de gastos. Pegá TODO supabase/061_contabilidad.sql (rol postgres), dale Run y recargá.',
      }
    }
    return { filas: [], error: error.message }
  }
  const filas: GastoFila[] = []
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const f = filaGasto(row)
    if (f) filas.push(f)
  }
  return { filas, error: null }
}

export async function crearGasto(
  client: SupabaseClient,
  input: {
    empresaId: string
    usuarioId: string
    categoria: CategoriaGasto
    descripcion: string
    monto: number
    fecha: string
    recurrente: boolean
    frecuencia: FrecuenciaGasto | null
  },
): Promise<string | null> {
  const { error } = await client.from('gastos').insert({
    empresa_id: input.empresaId,
    usuario_id: input.usuarioId,
    categoria: input.categoria,
    descripcion: input.descripcion.trim(),
    monto: input.monto,
    fecha: input.fecha,
    recurrente: input.recurrente,
    frecuencia: input.recurrente ? input.frecuencia : null,
  })
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('gastos') || t.includes('schema cache') || t.includes('does not exist')) {
    return 'Falta la tabla de gastos. Pegá TODO supabase/061_contabilidad.sql (rol postgres), dale Run y recargá.'
  }
  return error.message
}

export async function anularGasto(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client
    .from('gastos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  return error ? error.message : null
}
