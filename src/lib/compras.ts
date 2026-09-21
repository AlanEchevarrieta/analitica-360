import type { SupabaseClient } from '@supabase/supabase-js'
import { formatoFechaDia } from './fechas'

export type CompraFila = {
  id: string
  fecha: string
  proveedor: string | null
  productos: string
  total: number
  notas: string | null
  anulada: boolean
  ordenCompraId: string | null
  costoFlete: number
  costoImpuestos: number
  costoOtros: number
  descripcionOtros: string | null
  totalCostosAdicionales: number
  totalReal: number
}

export type CompraFicha = CompraFila & {
  items: { nombre: string; cantidad: number; costoUnitario: number; subtotal: number }[]
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
    .select(
      'id, fecha, proveedor, total, notas, deleted_at, orden_compra_id, costo_flete, costo_impuestos, costo_otros, descripcion_otros, total_costos_adicionales, total_real, compras_items(producto_nombre, cantidad, costo_unitario, subtotal)',
      { count: 'exact' },
    )
    .order('fecha', { ascending: false })

  q = input.mostrarAnuladas ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null)

  if (qProveedor) q = q.ilike('proveedor', `%${qProveedor}%`)

  const tabla = await q.range(from, to)
  if (tabla.error) {
    const t = tabla.error.message.toLowerCase()
    if (t.includes('costo_flete') || t.includes('total_real') || t.includes('total_costos')) {
      let qCost = client
        .from('compras')
        .select('id, fecha, proveedor, total, notas, deleted_at, orden_compra_id, compras_items(producto_nombre, cantidad)', {
          count: 'exact',
        })
        .order('fecha', { ascending: false })
      qCost = input.mostrarAnuladas ? qCost.not('deleted_at', 'is', null) : qCost.is('deleted_at', null)
      if (qProveedor) qCost = qCost.ilike('proveedor', `%${qProveedor}%`)
      const retryCost = await qCost.range(from, to)
      if (retryCost.error) {
        const t2 = retryCost.error.message.toLowerCase()
        if (t2.includes('orden_compra_id')) {
          let q2 = client
            .from('compras')
            .select('id, fecha, proveedor, total, notas, deleted_at, compras_items(producto_nombre, cantidad)', {
              count: 'exact',
            })
            .order('fecha', { ascending: false })
          q2 = input.mostrarAnuladas ? q2.not('deleted_at', 'is', null) : q2.is('deleted_at', null)
          if (qProveedor) q2 = q2.ilike('proveedor', `%${qProveedor}%`)
          const retry = await q2.range(from, to)
          if (retry.error) return { filas: [], total: 0, error: mensajeErrorCompras(retry.error.message) }
          return { filas: mapCompras(retry.data as Record<string, unknown>[]), total: retry.count ?? 0, error: null }
        }
        return { filas: [], total: 0, error: mensajeErrorCompras(retryCost.error.message) }
      }
      return {
        filas: mapCompras(retryCost.data as Record<string, unknown>[]),
        total: retryCost.count ?? 0,
        error: null,
      }
    }
    if (t.includes('orden_compra_id')) {
      let q2 = client
        .from('compras')
        .select('id, fecha, proveedor, total, notas, deleted_at, compras_items(producto_nombre, cantidad)', {
          count: 'exact',
        })
        .order('fecha', { ascending: false })
      q2 = input.mostrarAnuladas ? q2.not('deleted_at', 'is', null) : q2.is('deleted_at', null)
      if (qProveedor) q2 = q2.ilike('proveedor', `%${qProveedor}%`)
      const retry = await q2.range(from, to)
      if (retry.error) return { filas: [], total: 0, error: mensajeErrorCompras(retry.error.message) }
      return { filas: mapCompras(retry.data as Record<string, unknown>[]), total: retry.count ?? 0, error: null }
    }
    return { filas: [], total: 0, error: mensajeErrorCompras(tabla.error.message) }
  }

  return { filas: mapCompras(tabla.data as Record<string, unknown>[]), total: tabla.count ?? 0, error: null }
}

function mapCompras(rows: Record<string, unknown>[]): CompraFila[] {
  return rows.map((row) => {
    const items = Array.isArray(row.compras_items) ? row.compras_items : []
    const productos = items
      .map((item) => {
        const i = item as Record<string, unknown>
        return `${String(i.producto_nombre ?? '')} × ${String(i.cantidad ?? '')}`
      })
      .filter(Boolean)
      .join(', ')
    const extras =
      Number(row.total_costos_adicionales ?? 0) ||
      Number(row.costo_flete ?? 0) + Number(row.costo_impuestos ?? 0) + Number(row.costo_otros ?? 0)
    const total = Number(row.total ?? 0)
    return {
      id: String(row.id),
      fecha: String(row.fecha ?? ''),
      proveedor: row.proveedor == null || row.proveedor === '' ? null : String(row.proveedor),
      productos,
      total,
      notas: row.notas == null || row.notas === '' ? null : String(row.notas),
      anulada: row.deleted_at != null,
      ordenCompraId: row.orden_compra_id == null || row.orden_compra_id === '' ? null : String(row.orden_compra_id),
      costoFlete: Number(row.costo_flete ?? 0),
      costoImpuestos: Number(row.costo_impuestos ?? 0),
      costoOtros: Number(row.costo_otros ?? 0),
      descripcionOtros:
        row.descripcion_otros == null || row.descripcion_otros === '' ? null : String(row.descripcion_otros),
      totalCostosAdicionales: extras,
      totalReal: Number(row.total_real ?? 0) > 0 ? Number(row.total_real) : total + extras,
    }
  })
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
    ubicacionDestino?: string | null
    costosAdicionales?: {
      flete: number
      impuestos: number
      otros: number
      descripcion: string
    }
  },
): Promise<string | null> {
  const args: Record<string, unknown> = {
    p_items: input.items,
    p_proveedor: input.proveedor,
    p_fecha: input.fecha,
    p_notas: input.notas,
    p_proveedor_id: input.proveedorId ?? null,
  }
  if (input.ubicacionDestino) args.p_ubicacion_destino = input.ubicacionDestino
  let { data, error } = await client.rpc('confirmar_compra', args)
  if (error && args.p_ubicacion_destino) {
    const t = error.message.toLowerCase()
    if (t.includes('p_ubicacion_destino') || t.includes('schema cache') || t.includes('could not find')) {
      delete args.p_ubicacion_destino
      const retry = await client.rpc('confirmar_compra', args)
      data = retry.data
      error = retry.error
    }
  }
  if (!error) {
    const extras = input.costosAdicionales
    const flete = Number(extras?.flete ?? 0)
    const impuestos = Number(extras?.impuestos ?? 0)
    const otros = Number(extras?.otros ?? 0)
    if (data && (flete > 0 || impuestos > 0 || otros > 0)) {
      const costos = await client.rpc('aplicar_costos_compra', {
        p_id: data,
        p_flete: Math.max(0, flete),
        p_impuestos: Math.max(0, impuestos),
        p_otros: Math.max(0, otros),
        p_descripcion: extras?.descripcion ?? '',
      })
      if (costos.error) {
        const t = costos.error.message.toLowerCase()
        if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
          return 'Falta crear costos de compra. Pegá TODO supabase/069_costos_compras.sql (rol postgres), dale Run y recargá.'
        }
        return costos.error.message
      }
    }
    return null
  }
  const msg = error.message
  if (msg.includes('SIN_PRODUCTOS')) return 'Agregá al menos un producto'
  if (msg.includes('NO_AUTORIZADO')) return 'No tenés permiso para registrar compras'
  if (msg.includes('PRODUCTO_INVALIDO')) return 'Hay un producto que ya no está disponible'
  if (msg.includes('PROVEEDOR_INVALIDO')) return 'Ese proveedor ya no está disponible'
  if (msg.includes('VARIANTE_INVALIDA')) return 'La variante elegida no es válida'
  if (msg.includes('UBICACION_INVALIDA')) return 'Esa ubicación no está disponible'
  return 'No se pudo confirmar la compra. Corré supabase/016_compras.sql, supabase/022_proveedores.sql, supabase/036_variantes_compras_dimensiones.sql, supabase/046_lotes.sql y supabase/047_ubicaciones.sql en el SQL Editor.'
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
  return formatoFechaDia(iso)
}

export function hoyCompraISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export async function obtenerCompra(
  client: SupabaseClient,
  id: string,
): Promise<{ data: CompraFicha | null; error: string | null }> {
  let res = await client
    .from('compras')
    .select(
      'id, fecha, proveedor, total, notas, deleted_at, orden_compra_id, costo_flete, costo_impuestos, costo_otros, descripcion_otros, total_costos_adicionales, total_real, compras_items(producto_nombre, cantidad, costo_unitario, subtotal)',
    )
    .eq('id', id)
    .maybeSingle()
  if (res.error) {
    const t = res.error.message.toLowerCase()
    if (t.includes('costo_flete') || t.includes('total_real') || t.includes('does not exist')) {
      res = await client
        .from('compras')
        .select(
          'id, fecha, proveedor, total, notas, deleted_at, orden_compra_id, compras_items(producto_nombre, cantidad, costo_unitario, subtotal)',
        )
        .eq('id', id)
        .maybeSingle()
    }
  }
  if (res.error) return { data: null, error: res.error.message }
  if (!res.data) return { data: null, error: 'No se encontró la compra' }
  const fila = mapCompras([res.data as Record<string, unknown>])[0]
  const itemsRaw = (res.data as Record<string, unknown>).compras_items
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []).map((item) => {
    const i = item as Record<string, unknown>
    const cantidad = Number(i.cantidad ?? 0)
    const costoUnitario = Number(i.costo_unitario ?? 0)
    return {
      nombre: String(i.producto_nombre ?? 'Producto'),
      cantidad,
      costoUnitario,
      subtotal: Number(i.subtotal ?? cantidad * costoUnitario),
    }
  })
  return { data: { ...fila, items }, error: null }
}
