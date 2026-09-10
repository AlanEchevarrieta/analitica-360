import type { SupabaseClient } from '@supabase/supabase-js'

export type AtributoFila = {
  id: string
  nombre: string
  valores: string[]
}

export type VarianteFila = {
  id: string
  productoId: string
  sku: string
  atributos: Record<string, string>
  precioVenta: number | null
  costo: number | null
  activo: boolean
}

export const ATRIBUTOS_DEFAULT: { nombre: string; valores: string[] }[] = [
  { nombre: 'Color', valores: ['Negro', 'Blanco', 'Rojo', 'Verde', 'Azul', 'Marrón', 'Gris', 'Beige'] },
  { nombre: 'Talle', valores: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { nombre: 'Material', valores: ['Ecocuero', 'Cuero', 'Rafia', 'Tela', 'PVC'] },
  { nombre: 'Tamaño', valores: ['Chico', 'Mediano', 'Grande'] },
]

export function etiquetaCombo(atributos: Record<string, string>) {
  return Object.keys(atributos)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((k) => atributos[k])
    .filter(Boolean)
    .join('/')
}

export function slugSku(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 10)
    .toUpperCase()
}

export function skuAutomatico(nombreProducto: string, atributos: Record<string, string>) {
  const prod = slugSku(nombreProducto) || 'PROD'
  const vals = Object.keys(atributos)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((k) => slugSku(atributos[k] ?? ''))
    .filter(Boolean)
  return [prod, ...vals].join('-')
}

export function combinacionesDe(attrs: { nombre: string; valores: string[] }[]) {
  const vivos = attrs.filter((a) => a.nombre.trim() && a.valores.length > 0)
  if (vivos.length === 0) return [] as Record<string, string>[]
  return vivos.reduce<Record<string, string>[]>((acc, attr) => {
    const vals = attr.valores.map((v) => v.trim()).filter(Boolean)
    if (acc.length === 0) return vals.map((v) => ({ [attr.nombre]: v }))
    return acc.flatMap((prev) => vals.map((v) => ({ ...prev, [attr.nombre]: v })))
  }, [])
}

export function mismaCombinacion(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  if (ka.length !== kb.length) return false
  return ka.every((k, i) => k === kb[i] && a[k] === b[k])
}

function msgSqlFaltante(error: string) {
  const t = error.toLowerCase()
  if (t.includes('schema cache') || t.includes('does not exist') || t.includes('atributos') || t.includes('usa_variantes')) {
    return 'Falta el módulo de variantes. Pegá TODO supabase/035_variantes.sql (rol postgres), dale Run y recargá.'
  }
  return error
}

function mapAtributo(row: Record<string, unknown>): AtributoFila {
  const raw = row.valores
  const valores = Array.isArray(raw) ? raw.map((v) => String(v)).filter(Boolean) : []
  return { id: String(row.id), nombre: String(row.nombre ?? ''), valores }
}

function mapVariante(row: Record<string, unknown>): VarianteFila {
  const attrs = row.atributos && typeof row.atributos === 'object' && !Array.isArray(row.atributos)
    ? (row.atributos as Record<string, unknown>)
    : {}
  const atributos: Record<string, string> = {}
  for (const [k, v] of Object.entries(attrs)) atributos[k] = String(v)
  return {
    id: String(row.id),
    productoId: String(row.producto_id),
    sku: row.sku == null ? '' : String(row.sku),
    atributos,
    precioVenta: row.precio_venta == null ? null : Number(row.precio_venta),
    costo: row.costo == null ? null : Number(row.costo),
    activo: row.activo !== false,
  }
}

export async function listarAtributos(
  client: SupabaseClient,
): Promise<{ filas: AtributoFila[]; error: string | null }> {
  const { data, error } = await client.from('atributos').select('id, nombre, valores').order('created_at')
  if (error) return { filas: [], error: msgSqlFaltante(error.message) }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapAtributo), error: null }
}

export async function sembrarAtributosDefault(
  client: SupabaseClient,
  empresaId: string,
): Promise<string | null> {
  const actuales = await listarAtributos(client)
  if (actuales.error) return actuales.error
  if (actuales.filas.length > 0) return null
  const { error } = await client.from('atributos').insert(
    ATRIBUTOS_DEFAULT.map((a) => ({ empresa_id: empresaId, nombre: a.nombre, valores: a.valores })),
  )
  return error ? msgSqlFaltante(error.message) : null
}

export async function guardarAtributo(
  client: SupabaseClient,
  input: { id?: string; empresaId: string; nombre: string; valores: string[] },
): Promise<string | null> {
  const nombre = input.nombre.trim()
  const valores = [...new Set(input.valores.map((v) => v.trim()).filter(Boolean))]
  if (!nombre) return 'El nombre del atributo es obligatorio'
  if (valores.length === 0) return 'Agregá al menos un valor'
  if (input.id) {
    const { error } = await client
      .from('atributos')
      .update({ nombre, valores })
      .eq('id', input.id)
    return error ? msgSqlFaltante(error.message) : null
  }
  const { error } = await client.from('atributos').insert({
    empresa_id: input.empresaId,
    nombre,
    valores,
  })
  return error ? msgSqlFaltante(error.message) : null
}

export async function eliminarAtributo(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client.from('atributos').delete().eq('id', id)
  return error ? msgSqlFaltante(error.message) : null
}

export async function listarVariantesProducto(
  client: SupabaseClient,
  productoId: string,
): Promise<{ filas: VarianteFila[]; error: string | null }> {
  const { data, error } = await client
    .from('producto_variantes')
    .select('id, producto_id, sku, atributos, precio_venta, costo, activo')
    .eq('producto_id', productoId)
    .is('deleted_at', null)
    .order('created_at')
  if (error) return { filas: [], error: msgSqlFaltante(error.message) }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapVariante), error: null }
}

export async function listarVariantesDeProductos(
  client: SupabaseClient,
  productoIds: string[],
): Promise<{ filas: VarianteFila[]; error: string | null }> {
  if (productoIds.length === 0) return { filas: [], error: null }
  const { data, error } = await client
    .from('producto_variantes')
    .select('id, producto_id, sku, atributos, precio_venta, costo, activo')
    .in('producto_id', productoIds)
    .is('deleted_at', null)
  if (error) return { filas: [], error: msgSqlFaltante(error.message) }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapVariante), error: null }
}

export async function listarVariantesActivas(
  client: SupabaseClient,
  productoIds: string[],
): Promise<{ filas: VarianteFila[]; error: string | null }> {
  if (productoIds.length === 0) return { filas: [], error: null }
  const { data, error } = await client
    .from('producto_variantes')
    .select('id, producto_id, sku, atributos, precio_venta, costo, activo')
    .in('producto_id', productoIds)
    .is('deleted_at', null)
    .eq('activo', true)
  if (error) return { filas: [], error: msgSqlFaltante(error.message) }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapVariante), error: null }
}

export async function guardarVariantesProducto(
  client: SupabaseClient,
  input: {
    productoId: string
    empresaId: string
    variantes: {
      id?: string
      sku: string
      atributos: Record<string, string>
      precioVenta: number | null
      costo: number | null
      activo: boolean
    }[]
  },
): Promise<string | null> {
  const actuales = await listarVariantesProducto(client, input.productoId)
  if (actuales.error) return actuales.error
  const idsKeep = new Set<string>()

  for (const v of input.variantes) {
    const payload = {
      producto_id: input.productoId,
      empresa_id: input.empresaId,
      sku: v.sku.trim() || null,
      atributos: v.atributos,
      precio_venta: v.precioVenta,
      costo: v.costo,
      activo: v.activo,
      deleted_at: null,
    }
    if (v.id) {
      const { error } = await client.from('producto_variantes').update(payload).eq('id', v.id)
      if (error) return msgSqlFaltante(error.message)
      idsKeep.add(v.id)
    } else {
      const { data, error } = await client.from('producto_variantes').insert(payload).select('id').maybeSingle()
      if (error) return msgSqlFaltante(error.message)
      if (data?.id) idsKeep.add(String(data.id))
    }
  }

  const aBorrar = actuales.filas.filter((a) => !idsKeep.has(a.id)).map((a) => a.id)
  if (aBorrar.length > 0) {
    const { error } = await client
      .from('producto_variantes')
      .update({ deleted_at: new Date().toISOString(), activo: false })
      .in('id', aBorrar)
    if (error) return msgSqlFaltante(error.message)
  }
  return null
}

export async function stockPorVariante(
  client: SupabaseClient,
  varianteIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (varianteIds.length === 0) return map
  const { data, error } = await client
    .from('movimientos_inventario')
    .select('variante_id, cantidad, signo, tipo')
    .in('variante_id', varianteIds)
    .is('deleted_at', null)
  if (error || !data) return map
  for (const row of data as Record<string, unknown>[]) {
    if (String(row.tipo ?? '') === 'transferencia') continue
    const id = String(row.variante_id ?? '')
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + Number(row.cantidad ?? 0) * Number(row.signo ?? 0))
  }
  return map
}

export type AnalyticsVariantes = {
  porColor: { name: string; unidades: number }[]
  porTalle: { name: string; unidades: number }[]
  combinaciones: { producto: string; combo: string; unidades: number }[]
  insightCombo: string
  insightPct: number
}

export async function cargarAnalyticsVariantes(
  client: SupabaseClient,
  desde: string,
  hasta: string,
): Promise<AnalyticsVariantes> {
  const vacio: AnalyticsVariantes = {
    porColor: [],
    porTalle: [],
    combinaciones: [],
    insightCombo: '',
    insightPct: 0,
  }
  const { data, error } = await client.rpc('analytics_variantes', { p_desde: desde, p_hasta: hasta })
  if (error || data == null) return vacio
  const row = data as Record<string, unknown>
  const asArr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    porColor: asArr(row.por_color).map((item) => {
      const p = item as Record<string, unknown>
      return { name: String(p.name ?? ''), unidades: Number(p.unidades ?? 0) }
    }),
    porTalle: asArr(row.por_talle).map((item) => {
      const p = item as Record<string, unknown>
      return { name: String(p.name ?? ''), unidades: Number(p.unidades ?? 0) }
    }),
    combinaciones: asArr(row.combinaciones).map((item) => {
      const p = item as Record<string, unknown>
      return {
        producto: String(p.producto ?? ''),
        combo: String(p.combo ?? ''),
        unidades: Number(p.unidades ?? 0),
      }
    }),
    insightCombo: String(row.insight_combo ?? ''),
    insightPct: Number(row.insight_pct ?? 0),
  }
}
