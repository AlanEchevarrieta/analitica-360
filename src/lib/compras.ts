import type { SupabaseClient } from '@supabase/supabase-js'

export type CompraFila = {
  id: string
  fecha: string
  proveedor: string | null
  productos: string
  total: number
  notas: string | null
  anulada: boolean
}

function mensajeErrorCompras(msg: string) {
  const t = msg.toLowerCase()
  if (
    t.includes('schema cache') ||
    t.includes('could not find the function') ||
    t.includes('pgrst202') ||
    t.includes('does not exist')
  ) {
    return 'Falta crear el módulo en Supabase. Pegá TODO supabase/016_compras.sql y supabase/037_numero_venta_anular_compras_categorias.sql en el SQL Editor, dale Run y recargá esta página.'
  }
  return `No se pudieron cargar las compras: ${msg}`
}

export async function listarComprasPaginado(
  client: SupabaseClient,
  input: { pagina: number; pageSize: number; proveedor: string; mostrarAnuladas: boolean },
): Promise<{ filas: CompraFila[]; total: number; error: string | null }> {
  const from = (input.pagina - 1) * input.pageSize
  const to = from + input.pageSize - 1
  const qProveedor = input.proveedor.trim()

  let q = client
    .from('compras')
    .select('id, fecha, proveedor, total, notas, deleted_at, compras_items(producto_nombre, cantidad)', { count: 'exact' })
    .order('fecha', { ascending: false })

  q = input.mostrarAnuladas ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null)

  if (qProveedor) q = q.ilike('proveedor', `%${qProveedor}%`)

  const tabla = await q.range(from, to)
  if (tabla.error) {
    return { filas: [], total: 0, error: mensajeErrorCompras(tabla.error.message) }
  }

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
      anulada: row.deleted_at != null,
    }
  })

  return { filas, total: tabla.count ?? 0, error: null }
}

export async function confirmarCompra(
  client: SupabaseClient,
  input: {
    items: {
      producto_id: string
      producto_nombre: string
      cantidad: number
      costo_unitario: number
      variante_id?: string | null
      lote_id?: string | null
    }[]
    proveedor: string
    proveedorId?: string | null
    fecha: string
    notas: string
  },
): Promise<string | null> {
  const { error } = await client.rpc('confirmar_compra', {
    p_items: input.items,
    p_proveedor: input.proveedor,
    p_fecha: input.fecha,
    p_notas: input.notas,
    p_proveedor_id: input.proveedorId ?? null,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('SIN_PRODUCTOS')) return 'Agregá al menos un producto'
  if (msg.includes('NO_AUTORIZADO')) return 'No tenés permiso para registrar compras'
  if (msg.includes('PRODUCTO_INVALIDO')) return 'Hay un producto que ya no está disponible'
  if (msg.includes('PROVEEDOR_INVALIDO')) return 'Ese proveedor ya no está disponible'
  if (msg.includes('VARIANTE_INVALIDA')) return 'La variante elegida no es válida'
  return 'No se pudo confirmar la compra. Corré supabase/016_compras.sql, supabase/022_proveedores.sql, supabase/036_variantes_compras_dimensiones.sql y supabase/046_lotes.sql en el SQL Editor.'
}

export async function anularCompra(
  client: SupabaseClient,
  id: string,
  motivo: string,
): Promise<string | null> {
  const { error } = await client.rpc('anular_compra', { p_id: id, p_motivo: motivo })
  if (!error) return null
  const msg = error.message
  if (msg.includes('NO_AUTORIZADO')) return 'Solo el dueño puede anular compras'
  if (msg.includes('MOTIVO_OBLIGATORIO')) return 'El motivo de anulación es obligatorio'
  if (msg.includes('COMPRA_INVALIDA')) return 'Esa compra ya no se puede anular'
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta actualizar la anulación de compras. Pegá TODO supabase/037_numero_venta_anular_compras_categorias.sql (rol postgres), dale Run y recargá.'
  }
  return `No se pudo anular la compra: ${msg}`
}

export async function crearProductoParaCompra(
  client: SupabaseClient,
  input: { nombre: string; categoria?: string; precioVenta?: number },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client.rpc('crear_producto', {
    p_nombre: input.nombre,
    p_categoria: input.categoria ?? '',
    p_precio_venta: input.precioVenta ?? 0,
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
