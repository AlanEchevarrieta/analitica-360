import type { SupabaseClient } from '@supabase/supabase-js'

export type AtributoFila = {
  id: string
  nombre: string
  valores: string[]
  activoVentas: boolean
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

export function emojiStock(stock: number, umbral = 5) {
  if (stock <= 0) return '🔴'
  if (stock <= umbral) return '🟡'
  return '🟢'
}

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

export function normalizarAtributos(attrs: Record<string, unknown> | null | undefined): Record<string, string> {
  const atributos: Record<string, string> = {}
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return atributos
  for (const [k, v] of Object.entries(attrs)) {
    const key = k.trim()
    if (!key) continue
    atributos[key] = String(v ?? '').trim()
  }
  return atributos
}

export function precioVarianteOBase(precioVariante: number | null | undefined, precioBase: number) {
  if (precioVariante == null || !Number.isFinite(precioVariante)) return precioBase
  return precioVariante
}

export function costoPromedioPonderado(
  items: { costo: number; stock: number }[],
): number | null {
  const vivos = items.filter((i) => Number.isFinite(i.costo) && i.costo > 0)
  if (vivos.length === 0) return null
  const peso = vivos.reduce((acc, i) => acc + Math.max(0, i.stock), 0)
  const bruto =
    peso > 0
      ? vivos.reduce((acc, i) => acc + i.costo * Math.max(0, i.stock), 0) / peso
      : vivos.reduce((acc, i) => acc + i.costo, 0) / vivos.length
  return Math.round(bruto * 100) / 100
}

export function sumaStockItems(items: { stock: number }[]) {
  return items.reduce((acc, i) => acc + i.stock, 0)
}

export function rangoMargenVariantes(variantes: VarianteFila[]): { min: number; max: number } | null {
  const pcts: number[] = []
  for (const v of variantes) {
    if (!v.activo) continue
    const precio = v.precioVenta
    const costo = v.costo
    if (precio == null || !Number.isFinite(precio) || precio <= 0) continue
    if (costo == null || !Number.isFinite(costo) || costo < 0) continue
    pcts.push(((precio - costo) / precio) * 100)
  }
  if (pcts.length === 0) return null
  return { min: Math.min(...pcts), max: Math.max(...pcts) }
}

export function formatoRangoMargen(rango: { min: number; max: number }) {
  const a = Math.round(rango.min)
  const b = Math.round(rango.max)
  if (a === b) return `${a}%`
  return `${a}% - ${b}%`
}

export function variantePorSeleccion(
  variantes: VarianteFila[],
  sel: Record<string, string>,
): VarianteFila | null {
  const keys = Object.keys(sel).filter((k) => Boolean(sel[k]))
  if (keys.length === 0) return null
  const hits = variantes.filter((v) => keys.every((k) => v.atributos[k] === sel[k]))
  return hits.find((v) => v.activo) ?? hits[0] ?? null
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
  return { id: String(row.id), nombre: String(row.nombre ?? ''), valores, activoVentas: row.activo_ventas !== false }
}

function mapVariante(row: Record<string, unknown>): VarianteFila {
  const raw = row.atributos
  const attrs =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    id: String(row.id),
    productoId: String(row.producto_id),
    sku: row.sku == null ? '' : String(row.sku),
    atributos: normalizarAtributos(attrs),
    precioVenta: row.precio_venta == null || row.precio_venta === '' ? null : Number(row.precio_venta),
    costo: row.costo == null || row.costo === '' ? null : Number(row.costo),
    activo: row.activo !== false,
  }
}

export async function listarAtributos(
  client: SupabaseClient,
): Promise<{ filas: AtributoFila[]; error: string | null }> {
  const conActivo = await client.from('atributos').select('id, nombre, valores, activo_ventas').order('created_at')
  const res =
    conActivo.error && /activo_ventas/i.test(conActivo.error.message)
      ? await client.from('atributos').select('id, nombre, valores').order('created_at')
      : conActivo
  if (res.error) return { filas: [], error: msgSqlFaltante(res.error.message) }
  return { filas: ((res.data ?? []) as Record<string, unknown>[]).map(mapAtributo), error: null }
}

export async function sembrarAtributosDefault(
  client: SupabaseClient,
  empresaId: string,
): Promise<string | null> {
  const actuales = await listarAtributos(client)
  if (actuales.error) return actuales.error
  if (actuales.filas.length > 0) return null
  const { error } = await client.from('atributos').insert(
    ATRIBUTOS_DEFAULT.map((a) => ({
      empresa_id: empresaId,
      nombre: a.nombre,
      valores: a.valores,
      activo_ventas: true,
    })),
  )
  if (error && /activo_ventas/i.test(error.message)) {
    const retry = await client.from('atributos').insert(
      ATRIBUTOS_DEFAULT.map((a) => ({ empresa_id: empresaId, nombre: a.nombre, valores: a.valores })),
    )
    return retry.error ? msgSqlFaltante(retry.error.message) : null
  }
  return error ? msgSqlFaltante(error.message) : null
}

export async function guardarAtributo(
  client: SupabaseClient,
  input: { id?: string; empresaId: string; nombre: string; valores: string[]; activoVentas?: boolean },
): Promise<string | null> {
  const nombre = input.nombre.trim()
  const valores = [...new Set(input.valores.map((v) => v.trim()).filter(Boolean))]
  if (!nombre) return 'El nombre del atributo es obligatorio'
  if (valores.length === 0) return 'Agregá al menos un valor'
  const activo = input.activoVentas !== false
  if (input.id) {
    const upd = await client
      .from('atributos')
      .update({ nombre, valores, activo_ventas: activo })
      .eq('id', input.id)
    if (upd.error && /activo_ventas/i.test(upd.error.message)) {
      const { error } = await client.from('atributos').update({ nombre, valores }).eq('id', input.id)
      return error ? msgSqlFaltante(error.message) : null
    }
    return upd.error ? msgSqlFaltante(upd.error.message) : null
  }
  const ins = await client.from('atributos').insert({
    empresa_id: input.empresaId,
    nombre,
    valores,
    activo_ventas: activo,
  })
  if (ins.error && /activo_ventas/i.test(ins.error.message)) {
    const { error } = await client.from('atributos').insert({ empresa_id: input.empresaId, nombre, valores })
    return error ? msgSqlFaltante(error.message) : null
  }
  return ins.error ? msgSqlFaltante(ins.error.message) : null
}

export async function atributoTieneVariantesActivas(
  client: SupabaseClient,
  nombre: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('producto_variantes')
    .select('atributos')
    .is('deleted_at', null)
    .eq('activo', true)
    .limit(500)
  if (error || !data) return false
  return (data as Record<string, unknown>[]).some((row) => {
    const attrs = row.atributos as Record<string, unknown> | null
    return attrs != null && Object.prototype.hasOwnProperty.call(attrs, nombre)
  })
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
  if (error) {
    console.log('[variantes] listarVariantesActivas error', error.message, productoIds)
    return { filas: [], error: msgSqlFaltante(error.message) }
  }
  const filas = ((data ?? []) as Record<string, unknown>[]).map(mapVariante)
  console.log('[variantes] listarVariantesActivas', {
    productoIds,
    cantidad: filas.length,
    filas: filas.map((f) => ({
      id: f.id,
      productoId: f.productoId,
      atributos: f.atributos,
      precioVenta: f.precioVenta,
    })),
  })
  return { filas, error: null }
}

export async function contarVariantesActivasPorProducto(
  client: SupabaseClient,
  productoIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (productoIds.length === 0) return map
  const { data, error } = await client
    .from('producto_variantes')
    .select('producto_id')
    .in('producto_id', productoIds)
    .is('deleted_at', null)
    .eq('activo', true)
  if (error || !data) {
    console.log('[variantes] contarVariantesActivasPorProducto error', error?.message)
    return map
  }
  for (const row of data as Record<string, unknown>[]) {
    const id = String(row.producto_id)
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
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
      atributos: normalizarAtributos(v.atributos),
      precio_venta: v.precioVenta,
      costo: v.costo,
      activo: v.activo,
      deleted_at: null,
    }
    console.log('[variantes] guardar payload', payload)
    if (v.id) {
      const { error } = await client.from('producto_variantes').update(payload).eq('id', v.id)
      if (error) {
        console.log('[variantes] update error', error.message)
        return msgSqlFaltante(error.message)
      }
      idsKeep.add(v.id)
    } else {
      const { data, error } = await client
        .from('producto_variantes')
        .insert(payload)
        .select('id, empresa_id, producto_id')
        .maybeSingle()
      if (error) {
        console.log('[variantes] insert error', error.message, payload)
        return msgSqlFaltante(error.message)
      }
      let id = data?.id ? String(data.id) : ''
      if (!id) {
        const rec = await listarVariantesProducto(client, input.productoId)
        const hit = rec.filas.find((f) => mismaCombinacion(f.atributos, payload.atributos))
        id = hit?.id ?? ''
      }
      if (!id) {
        return 'No se pudo guardar la variante. Revisá que empresa_id coincida con la empresa y que el SQL 035 esté corrido.'
      }
      console.log('[variantes] insert ok', { id, empresa_id: data?.empresa_id, producto_id: data?.producto_id })
      idsKeep.add(id)
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

export async function asegurarVariante(
  client: SupabaseClient,
  input: {
    productoId: string
    empresaId: string
    atributos: Record<string, string>
    precioVenta: number | null
    costo: number | null
    nombreProducto: string
  },
): Promise<{ fila: VarianteFila | null; error: string | null }> {
  const actuales = await listarVariantesProducto(client, input.productoId)
  if (actuales.error) return { fila: null, error: actuales.error }
  const existente = actuales.filas.find((v) => mismaCombinacion(v.atributos, input.atributos))
  if (existente) return { fila: existente, error: null }
  const sku = skuAutomatico(input.nombreProducto, input.atributos)
  const { data, error } = await client
    .from('producto_variantes')
    .insert({
      producto_id: input.productoId,
      empresa_id: input.empresaId,
      sku,
      atributos: input.atributos,
      precio_venta: input.precioVenta,
      costo: input.costo,
      activo: true,
    })
    .select('id, producto_id, sku, atributos, precio_venta, costo, activo')
    .maybeSingle()
  if (error) return { fila: null, error: msgSqlFaltante(error.message) }
  if (!data) return { fila: null, error: 'No se pudo crear la variante' }
  return { fila: mapVariante(data as Record<string, unknown>), error: null }
}

export async function registrarStockInicialVariante(
  client: SupabaseClient,
  input: { productoId: string; empresaId: string; varianteId: string; cantidad: number },
): Promise<string | null> {
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) return null
  const { data: auth } = await client.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return 'NO_AUTENTICADO'
  const { error } = await client.from('movimientos_inventario').insert({
    empresa_id: input.empresaId,
    producto_id: input.productoId,
    usuario_id: uid,
    tipo: 'ajuste_positivo',
    cantidad: input.cantidad,
    signo: 1,
    motivo: 'Stock inicial de variante',
    variante_id: input.varianteId,
  })
  return error ? msgSqlFaltante(error.message) : null
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
