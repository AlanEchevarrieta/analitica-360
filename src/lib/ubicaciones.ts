import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoUbicacion = 'deposito' | 'local' | 'stand' | 'feria' | 'otro'

export type UbicacionFila = {
  id: string
  nombre: string
  descripcion: string | null
  tipo: TipoUbicacion
  activo: boolean
}

export const TIPOS_UBICACION: { id: TipoUbicacion; label: string }[] = [
  { id: 'deposito', label: 'Depósito' },
  { id: 'local', label: 'Local' },
  { id: 'stand', label: 'Stand' },
  { id: 'feria', label: 'Feria' },
  { id: 'otro', label: 'Otro' },
]

export function etiquetaTipoUbicacion(tipo: string) {
  return TIPOS_UBICACION.find((t) => t.id === tipo)?.label ?? 'Otro'
}

function msgSql(msg: string) {
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('does not exist') || t.includes('ubicacion')) {
    return 'Falta el módulo de ubicaciones. Pegá TODO supabase/032_inventario_movimientos.sql y supabase/047_ubicaciones.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

function normalizarTipo(raw: unknown): TipoUbicacion {
  const t = String(raw ?? 'otro')
  if (t === 'deposito' || t === 'local' || t === 'stand' || t === 'feria' || t === 'otro') return t
  return 'otro'
}

function mapFila(row: Record<string, unknown>): UbicacionFila {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    descripcion: row.descripcion == null || row.descripcion === '' ? null : String(row.descripcion),
    tipo: normalizarTipo(row.tipo),
    activo: row.activo !== false,
  }
}

export async function listarUbicaciones(
  client: SupabaseClient,
  input?: { soloActivas?: boolean },
): Promise<{ filas: UbicacionFila[]; error: string | null }> {
  let q = client
    .from('ubicaciones')
    .select('id, nombre, descripcion, tipo, activo')
    .order('created_at', { ascending: true })
    .order('nombre', { ascending: true })
  if (input?.soloActivas !== false) q = q.eq('activo', true)
  const { data, error } = await q
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('tipo')) {
      let q2 = client.from('ubicaciones').select('id, nombre, descripcion, activo').order('nombre')
      if (input?.soloActivas !== false) q2 = q2.eq('activo', true)
      const retry = await q2
      if (retry.error) {
        if (retry.error.message.toLowerCase().includes('ubicaciones') || retry.error.message.toLowerCase().includes('schema cache')) {
          return { filas: [], error: null }
        }
        return { filas: [], error: msgSql(retry.error.message) }
      }
      return { filas: ((retry.data ?? []) as Record<string, unknown>[]).map(mapFila), error: null }
    }
    if (t.includes('ubicaciones') || t.includes('schema cache') || t.includes('does not exist')) {
      return { filas: [], error: null }
    }
    return { filas: [], error: msgSql(error.message) }
  }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapFila), error: null }
}

export async function guardarUbicacion(
  client: SupabaseClient,
  input: {
    id?: string
    empresaId: string
    nombre: string
    descripcion: string
    tipo: TipoUbicacion
    activo: boolean
  },
): Promise<string | null> {
  const nombre = input.nombre.trim()
  if (!nombre) return 'El nombre es obligatorio'
  const payload: Record<string, unknown> = {
    empresa_id: input.empresaId,
    nombre,
    descripcion: input.descripcion.trim() || null,
    tipo: input.tipo,
    activo: input.activo,
  }
  if (input.id) {
    const { error } = await client.from('ubicaciones').update(payload).eq('id', input.id)
    if (!error) return null
    const t = error.message.toLowerCase()
    if (t.includes('tipo')) {
      delete payload.tipo
      const retry = await client.from('ubicaciones').update(payload).eq('id', input.id)
      return retry.error ? msgSql(retry.error.message) : null
    }
    if (t.includes('duplicate') || t.includes('unique')) return 'Ya existe una ubicación con ese nombre'
    return msgSql(error.message)
  }
  const { error } = await client.from('ubicaciones').insert(payload)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('tipo')) {
    delete payload.tipo
    const retry = await client.from('ubicaciones').insert(payload)
    return retry.error ? msgSql(retry.error.message) : null
  }
  if (t.includes('duplicate') || t.includes('unique')) return 'Ya existe una ubicación con ese nombre'
  return msgSql(error.message)
}

export async function stockPorUbicaciones(
  client: SupabaseClient,
  productoIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>()
  if (productoIds.length === 0) return out
  const PAGE = 100
  const data: Record<string, unknown>[] = []
  for (let i = 0; i < productoIds.length; i += PAGE) {
    const res = await client
      .from('movimientos_inventario')
      .select('producto_id, tipo, cantidad, signo, ubicacion_origen, ubicacion_destino')
      .in('producto_id', productoIds.slice(i, i + PAGE))
      .is('deleted_at', null)
    if (res.error || !res.data) continue
    data.push(...(res.data as Record<string, unknown>[]))
  }
  for (const row of data as Record<string, unknown>[]) {
    const pid = String(row.producto_id ?? '')
    if (!pid) continue
    const tipo = String(row.tipo ?? '')
    const cant = Number(row.cantidad ?? 0)
    const signo = Number(row.signo ?? 0)
    const orig = row.ubicacion_origen == null ? '' : String(row.ubicacion_origen)
    const dest = row.ubicacion_destino == null ? '' : String(row.ubicacion_destino)
    let porProd = out.get(pid)
    if (!porProd) {
      porProd = new Map()
      out.set(pid, porProd)
    }
    const add = (nombre: string, delta: number) => {
      if (!nombre) return
      porProd!.set(nombre, (porProd!.get(nombre) ?? 0) + delta)
    }
    if (tipo === 'transferencia') {
      if (signo === 1) add(dest, cant)
      if (signo === -1) add(orig, -cant)
      continue
    }
    if (dest) add(dest, cant * signo)
    else if (orig) add(orig, cant * signo)
  }
  return out
}

export function stockDe(mapa: Map<string, Map<string, number>>, productoId: string, ubicacion: string) {
  return mapa.get(productoId)?.get(ubicacion) ?? 0
}

export function esCasaStand(ubicaciones: { nombre: string }[]) {
  if (ubicaciones.length !== 2) return false
  const n = ubicaciones.map((u) => u.nombre.toLowerCase())
  return n.includes('casa') && n.includes('stand')
}

export async function eliminarUbicacion(
  client: SupabaseClient,
  ubicacion: { id: string; nombre: string },
): Promise<string | null> {
  const orig = await client
    .from('movimientos_inventario')
    .select('id', { count: 'exact', head: true })
    .eq('ubicacion_origen', ubicacion.nombre)
    .is('deleted_at', null)
  if (orig.error) return msgSql(orig.error.message)
  const dest = await client
    .from('movimientos_inventario')
    .select('id', { count: 'exact', head: true })
    .eq('ubicacion_destino', ubicacion.nombre)
    .is('deleted_at', null)
  if (dest.error) return msgSql(dest.error.message)
  if ((orig.count ?? 0) + (dest.count ?? 0) > 0) {
    return 'Esta ubicación tiene movimientos registrados. Desactivala en vez de eliminarla.'
  }
  const { error } = await client.from('ubicaciones').delete().eq('id', ubicacion.id)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('permission') || t.includes('rls') || t.includes('42501')) {
    return 'No se pudo eliminar. Pegá supabase/047_ubicaciones.sql (rol postgres) o desactivala.'
  }
  return msgSql(error.message)
}
