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
): Promise<string | null> {
  const { error } = await client.rpc('crear_producto', {
    p_nombre: input.nombre,
    p_categoria: input.categoria,
    p_precio_venta: input.precioVenta,
    p_costo: input.costo,
    p_stock_inicial: input.stockInicial,
    p_activo: input.activo,
  })
  return error ? error.message : null
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
