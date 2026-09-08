import type { SupabaseClient } from '@supabase/supabase-js'

export type CompraFila = {
  id: string
  fecha: string
  proveedor: string | null
  productos: string
  total: number
  notas: string | null
}

function mapearFilas(data: unknown): CompraFila[] {
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    fecha: String(row.fecha ?? ''),
    proveedor: row.proveedor == null || row.proveedor === '' ? null : String(row.proveedor),
    productos: String(row.productos ?? ''),
    total: Number(row.total ?? 0),
    notas: row.notas == null || row.notas === '' ? null : String(row.notas),
  }))
}

function mensajeErrorCompras(msg: string) {
  const t = msg.toLowerCase()
  if (
    t.includes('schema cache') ||
    t.includes('could not find the function') ||
    t.includes('pgrst202') ||
    t.includes('does not exist')
  ) {
    return 'Falta crear el módulo en Supabase. Pegá TODO supabase/016_compras.sql en el SQL Editor, dale Run y recargá esta página.'
  }
  return `No se pudieron cargar las compras: ${msg}`
}

export async function listarCompras(
  client: SupabaseClient,
): Promise<{ filas: CompraFila[]; error: string | null }> {
  const rpc = await client.rpc('listar_compras_empresa')
  if (!rpc.error) {
    return { filas: mapearFilas(rpc.data), error: null }
  }

  const tabla = await client
    .from('compras')
    .select('id, fecha, proveedor, total, notas, compras_items(producto_nombre, cantidad)')
    .is('deleted_at', null)
    .order('fecha', { ascending: false })

  if (!tabla.error && tabla.data) {
    const filas = (tabla.data as Record<string, unknown>[]).map((row) => {
      const items = Array.isArray(row.compras_items) ? row.compras_items : []
      const productos = items
        .map((item) => {
          const i = item as Record<string, unknown>
          return `${String(i.producto_nombre ?? '')} × ${String(i.cantidad ?? '')}`
        })
        .filter(Boolean)
        .join(', ')
      return {
        id: String(row.id),
        fecha: String(row.fecha ?? ''),
        proveedor: row.proveedor == null || row.proveedor === '' ? null : String(row.proveedor),
        productos,
        total: Number(row.total ?? 0),
        notas: row.notas == null || row.notas === '' ? null : String(row.notas),
      }
    })
    return { filas, error: null }
  }

  return { filas: [], error: mensajeErrorCompras(rpc.error.message) }
}

export async function confirmarCompra(
  client: SupabaseClient,
  input: {
    items: {
      producto_id: string
      producto_nombre: string
      cantidad: number
      costo_unitario: number
    }[]
    proveedor: string
    fecha: string
    notas: string
  },
): Promise<string | null> {
  const { error } = await client.rpc('confirmar_compra', {
    p_items: input.items,
    p_proveedor: input.proveedor,
    p_fecha: input.fecha,
    p_notas: input.notas,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('SIN_PRODUCTOS')) return 'Agregá al menos un producto'
  if (msg.includes('NO_AUTORIZADO')) return 'No tenés permiso para registrar compras'
  if (msg.includes('PRODUCTO_INVALIDO')) return 'Hay un producto que ya no está disponible'
  return 'No se pudo confirmar la compra. Corré supabase/016_compras.sql en el SQL Editor.'
}

export async function crearProductoParaCompra(
  client: SupabaseClient,
  input: { nombre: string; precioVenta: number },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client.rpc('crear_producto', {
    p_nombre: input.nombre,
    p_categoria: '',
    p_precio_venta: input.precioVenta,
    p_costo: 0,
    p_stock_inicial: 0,
    p_activo: true,
  })
  if (error) return { id: null, error: error.message }
  return { id: data ? String(data) : null, error: null }
}

export function formatoFechaCompra(iso: string) {
  const raw = String(iso).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function hoyCompraISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}
