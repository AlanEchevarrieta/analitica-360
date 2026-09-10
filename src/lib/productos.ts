import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductoFila = {
  id: string
  nombre: string
  categoria: string | null
  categoria_id: string | null
  activo: boolean
  precio_venta: number
  costo: number
  stock_actual: number
}

function filaProducto(row: Record<string, unknown>): ProductoFila {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    categoria: row.categoria == null ? null : String(row.categoria),
    categoria_id: row.categoria_id == null || row.categoria_id === '' ? null : String(row.categoria_id),
    activo: Boolean(row.activo),
    precio_venta: Number(row.precio_venta ?? 0),
    costo: Number(row.costo ?? 0),
    stock_actual: Number(row.stock_actual ?? 0),
  }
}

export async function listarProductosPaginado(
  client: SupabaseClient,
  input: {
    pagina: number
    pageSize: number
    busqueda: string
    categoria: string
    estado: 'todos' | 'activos' | 'inactivos'
    stock: 'todos' | 'con' | 'sin' | 'bajo'
    margen: 'todos' | 'alto' | 'medio' | 'bajo'
  },
): Promise<{ filas: ProductoFila[]; total: number; activos: number; categorias: string[]; error: string | null }> {
  const from = (input.pagina - 1) * input.pageSize
  const to = from + input.pageSize - 1
  const q = input.busqueda.trim()

  let query = client
    .from('productos')
    .select('id, nombre, categoria, activo, precio_venta, costo', { count: 'exact' })
    .is('deleted_at', null)
    .order('nombre', { ascending: true })

  if (q) query = query.ilike('nombre', `%${q}%`)
  if (input.categoria) query = query.eq('categoria', input.categoria)
  if (input.estado === 'activos') query = query.eq('activo', true)
  if (input.estado === 'inactivos') query = query.eq('activo', false)

  const res = await query.range(from, to)
  if (res.error) return { filas: [], total: 0, activos: 0, categorias: [], error: res.error.message }

  const filasBase = ((res.data ?? []) as Record<string, unknown>[]).map(filaProducto)
  const ids = filasBase.map((p) => p.id)
  const stockMap = new Map<string, number>()
  if (ids.length > 0) {
    const mov = await client
      .from('movimientos_inventario')
      .select('producto_id, cantidad, signo')
      .in('producto_id', ids)
      .is('deleted_at', null)
    if (!mov.error && mov.data) {
      for (const row of mov.data) {
        const pid = String(row.producto_id)
        stockMap.set(pid, (stockMap.get(pid) ?? 0) + Number(row.cantidad ?? 0) * Number(row.signo ?? 0))
      }
    }
  }

  let filas = filasBase.map((p) => ({ ...p, stock_actual: stockMap.get(p.id) ?? 0 }))
  let total = res.count ?? 0

  if (input.stock !== 'todos' || input.margen !== 'todos') {
    let full = client
      .from('productos')
      .select('id, nombre, categoria, activo, precio_venta, costo')
      .is('deleted_at', null)
      .order('nombre', { ascending: true })
    if (q) full = full.ilike('nombre', `%${q}%`)
    if (input.categoria) full = full.eq('categoria', input.categoria)
    if (input.estado === 'activos') full = full.eq('activo', true)
    if (input.estado === 'inactivos') full = full.eq('activo', false)
    const allRes = await full
    if (allRes.error) return { filas: [], total: 0, activos: 0, categorias: [], error: allRes.error.message }
    const allBase = ((allRes.data ?? []) as Record<string, unknown>[]).map(filaProducto)
    const allIds = allBase.map((p) => p.id)
    const allStock = new Map<string, number>()
    if (allIds.length > 0) {
      const movAll = await client
        .from('movimientos_inventario')
        .select('producto_id, cantidad, signo')
        .in('producto_id', allIds)
        .is('deleted_at', null)
      if (!movAll.error && movAll.data) {
        for (const row of movAll.data) {
          const pid = String(row.producto_id)
          allStock.set(pid, (allStock.get(pid) ?? 0) + Number(row.cantidad ?? 0) * Number(row.signo ?? 0))
        }
      }
    }
    const filtradas = allBase
      .map((p) => ({ ...p, stock_actual: allStock.get(p.id) ?? 0 }))
      .filter((p) => {
        if (input.stock === 'con' && p.stock_actual <= 0) return false
        if (input.stock === 'sin' && p.stock_actual > 0) return false
        if (input.stock === 'bajo' && !(p.stock_actual > 0 && p.stock_actual < 5)) return false
        if (input.margen !== 'todos') {
          const pct = p.precio_venta <= 0 ? null : ((p.precio_venta - p.costo) / p.precio_venta) * 100
          if (pct == null) return false
          if (input.margen === 'alto' && !(pct > 40)) return false
          if (input.margen === 'medio' && !(pct >= 20 && pct <= 40)) return false
          if (input.margen === 'bajo' && !(pct < 20)) return false
        }
        return true
      })
    total = filtradas.length
    filas = filtradas.slice(from, to + 1)
  }

  const catsRes = await client.from('productos').select('categoria').is('deleted_at', null)
  const categorias = [
    ...new Set(
      (catsRes.data ?? [])
        .map((r) => (r.categoria == null ? '' : String(r.categoria).trim()))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'))

  const activosRes = await client
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('activo', true)

  return {
    filas,
    total,
    activos: activosRes.count ?? 0,
    categorias,
    error: null,
  }
}

export async function listarProductosNombres(
  client: SupabaseClient,
): Promise<{ filas: { id: string; nombre: string }[]; error: string | null }> {
  const { data, error } = await client
    .from('productos')
    .select('id, nombre')
    .is('deleted_at', null)
    .order('nombre', { ascending: true })
  if (error) return { filas: [], error: error.message }
  return {
    filas: (data ?? []).map((r) => ({ id: String(r.id), nombre: String(r.nombre) })),
    error: null,
  }
}

export async function listarProductos(
  client: SupabaseClient,
): Promise<{ filas: ProductoFila[]; error: string | null }> {
  const { data, error } = await client.rpc('listar_productos_empresa')
  if (error) return { filas: [], error: error.message }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(filaProducto), error: null }
}

export async function crearProducto(
  client: SupabaseClient,
  input: {
    nombre: string
    categoria: string
    precioVenta: number
    costo: number | null
    stockInicial: number
    activo: boolean
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client.rpc('crear_producto', {
    p_nombre: input.nombre,
    p_categoria: input.categoria,
    p_precio_venta: input.precioVenta,
    p_costo: input.costo,
    p_stock_inicial: input.stockInicial,
    p_activo: input.activo,
  })
  if (error) return { id: null, error: error.message }
  return { id: data ? String(data) : null, error: null }
}

export async function asignarCategoriaProducto(
  client: SupabaseClient,
  productoId: string,
  categoriaId: string | null,
): Promise<string | null> {
  const { error } = await client.from('productos').update({ categoria_id: categoriaId }).eq('id', productoId)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('categoria_id') || t.includes('schema cache') || t.includes('does not exist')) {
    return 'Falta categoria_id. Pegá TODO supabase/037_numero_venta_anular_compras_categorias.sql (rol postgres), dale Run y recargá.'
  }
  return error.message
}

export async function actualizarProducto(
  client: SupabaseClient,
  input: {
    id: string
    nombre: string
    categoria: string
    precioVenta: number
    costo: number | null
    activo: boolean
  },
): Promise<string | null> {
  const { error } = await client.rpc('actualizar_producto', {
    p_id: input.id,
    p_nombre: input.nombre,
    p_categoria: input.categoria,
    p_precio_venta: input.precioVenta,
    p_costo: input.costo,
    p_activo: input.activo,
  })
  return error ? error.message : null
}

export async function guardarDimensionesProducto(
  client: SupabaseClient,
  input: {
    id: string
    altoCm: number | null
    largoCm: number | null
    anchoCm: number | null
    pesoGr: number | null
  },
): Promise<string | null> {
  const { error } = await client
    .from('productos')
    .update({
      alto_cm: input.altoCm,
      largo_cm: input.largoCm,
      ancho_cm: input.anchoCm,
      peso_gr: input.pesoGr,
    })
    .eq('id', input.id)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('alto_cm') || t.includes('schema cache') || t.includes('does not exist')) {
    if (
      input.altoCm == null &&
      input.largoCm == null &&
      input.anchoCm == null &&
      input.pesoGr == null
    ) {
      return null
    }
    return 'Faltan las columnas de dimensiones. Pegá supabase/036_variantes_compras_dimensiones.sql (rol postgres) y recargá.'
  }
  return error.message
}

export async function leerDimensionesProducto(
  client: SupabaseClient,
  id: string,
): Promise<{ altoCm: string; largoCm: string; anchoCm: string; pesoGr: string }> {
  const vacio = { altoCm: '', largoCm: '', anchoCm: '', pesoGr: '' }
  const { data, error } = await client
    .from('productos')
    .select('alto_cm, largo_cm, ancho_cm, peso_gr')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return vacio
  const n = (v: unknown) => (v == null || v === '' ? '' : String(v))
  return {
    altoCm: n(data.alto_cm),
    largoCm: n(data.largo_cm),
    anchoCm: n(data.ancho_cm),
    pesoGr: n(data.peso_gr),
  }
}

export type VarianteStockResumen = {
  varianteId: string
  atributos: Record<string, string>
  precio: number | null
  costo: number | null
  activo: boolean
  stock: number
}

export type ProductoConStock = ProductoFila & {
  stockBase: number
  variantesStock: VarianteStockResumen[]
}

function mapVarianteStock(raw: unknown): VarianteStockResumen | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const id = v.variante_id == null ? '' : String(v.variante_id)
  if (!id) return null
  const attrs = v.atributos
  const atributos: Record<string, string> = {}
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    for (const [k, val] of Object.entries(attrs as Record<string, unknown>)) {
      atributos[k] = String(val ?? '')
    }
  }
  const precio = v.precio == null ? null : Number(v.precio)
  const costo = v.costo == null ? null : Number(v.costo)
  return {
    varianteId: id,
    atributos,
    precio: precio != null && Number.isFinite(precio) ? precio : null,
    costo: costo != null && Number.isFinite(costo) ? costo : null,
    activo: v.activo !== false,
    stock: Number(v.stock ?? 0),
  }
}

export async function listarProductosConStock(
  client: SupabaseClient,
): Promise<{ filas: ProductoConStock[]; error: string | null }> {
  const { data, error } = await client.rpc('listar_productos_con_stock')
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
      return {
        filas: [],
        error:
          'Falta listar_productos_con_stock. Pegá TODO supabase/038_perf_seguridad_productos_ventas.sql (rol postgres), dale Run y recargá.',
      }
    }
    return { filas: [], error: error.message }
  }
  const arr = Array.isArray(data) ? data : []
  const filas = arr.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>
    const varsRaw = Array.isArray(row.variantes_stock) ? row.variantes_stock : []
    const variantesStock = varsRaw.map(mapVarianteStock).filter((v): v is VarianteStockResumen => v != null)
    const stockBase = Number(row.stock_base ?? 0)
    const stockVars = variantesStock.filter((v) => v.activo).reduce((acc, v) => acc + v.stock, 0)
    return {
      ...filaProducto(row),
      stock_actual: variantesStock.some((v) => v.activo) ? stockVars : stockBase,
      stockBase,
      variantesStock,
    }
  })
  return { filas, error: null }
}

export function formatoARS(valor: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor)
}
