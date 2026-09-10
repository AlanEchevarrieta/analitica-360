import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductoFila = {
  id: string
  nombre: string
  categoria: string | null
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

export function formatoARS(valor: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor)
}
