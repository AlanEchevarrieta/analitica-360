import type { SupabaseClient } from '@supabase/supabase-js'
import { formatoFechaHora } from './fechas'

export type TipoDevolucion = 'devolucion' | 'cambio'
export type EstadoDevolucion = 'pendiente' | 'procesado' | 'cancelado'
export type TipoItemDevolucion = 'devuelto' | 'entregado'

export type ItemDevolucionInput = {
  productoId: string
  nombre: string
  varianteId?: string | null
  cantidad: number
  precioUnitario: number
  tipo: TipoItemDevolucion
}

export type DevolucionFila = {
  id: string
  numero: number | null
  tipo: TipoDevolucion
  estado: EstadoDevolucion
  fecha: string
  ventaId: string | null
  ventaLabel: string | null
  productos: string
  motivo: string | null
}

export type DevolucionFicha = {
  id: string
  numero: number | null
  tipo: TipoDevolucion
  estado: EstadoDevolucion
  fecha: string
  ventaId: string | null
  ventaLabel: string | null
  motivo: string | null
  notas: string | null
  items: {
    id: string
    productoId: string
    nombre: string
    cantidad: number
    precioUnitario: number
    tipo: TipoItemDevolucion
  }[]
  movimientos: { id: string; tipo: string; cantidad: number; signo: number; fecha: string }[]
}

export type VentaDevolucionHit = {
  id: string
  label: string
  items: { productoId: string; nombre: string; cantidad: number; precioUnitario: number }[]
}

export const MOTIVOS_DEVOLUCION = [
  'Producto defectuoso',
  'Talle/medida incorrecta',
  'El cliente cambió de opinión',
  'Otro',
] as const

export function etiquetaTipoDevolucion(tipo: string) {
  return tipo === 'cambio' ? 'Cambio' : 'Devolución'
}

export function estiloTipoDevolucion(tipo: string) {
  return tipo === 'cambio'
    ? { bg: 'rgba(59,130,246,0.18)', fg: '#3B82F6' }
    : { bg: 'rgba(239,68,68,0.18)', fg: '#EF4444' }
}

export function etiquetaEstadoDevolucion(estado: string) {
  if (estado === 'procesado') return 'Procesado'
  if (estado === 'cancelado') return 'Cancelado'
  return 'Pendiente'
}

export function estiloEstadoDevolucion(estado: string) {
  if (estado === 'procesado') return { bg: 'rgba(74,222,128,0.16)', fg: '#4ADE80' }
  if (estado === 'cancelado') return { bg: 'rgba(148,163,184,0.18)', fg: '#94A3B8' }
  return { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B' }
}

export function totalItems(items: { cantidad: number; precioUnitario: number }[]) {
  return items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
}

export function diferenciaCambio(devueltos: number, entregados: number) {
  return entregados - devueltos
}

function sqlFalta(msg: string) {
  const t = msg.toLowerCase()
  return t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')
}

export async function buscarVentasDevolucion(
  client: SupabaseClient,
  q: string,
): Promise<VentaDevolucionHit[]> {
  const t = q.trim()
  if (t.length < 1) return []
  const safe = t.replace(/[%*,()\\]/g, '')
  let query = client
    .from('ventas')
    .select('id, numero_venta, cliente_nombre, fecha')
    .is('deleted_at', null)
    .order('fecha', { ascending: false })
    .limit(12)
  if (safe) query = query.or(`numero_venta.ilike.%${safe}%,cliente_nombre.ilike.%${safe}%`)
  const { data, error } = await query
  if (error || !data) return []
  const ids = data.map((r) => String(r.id))
  const itemsRes = await client
    .from('ventas_items')
    .select('venta_id, producto_id, cantidad, precio_unitario, productos(nombre)')
    .in('venta_id', ids)
  const porVenta = new Map<string, VentaDevolucionHit['items']>()
  for (const row of (itemsRes.data ?? []) as Record<string, unknown>[]) {
    const vid = String(row.venta_id)
    const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
    const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
    const acc = porVenta.get(vid) ?? []
    acc.push({
      productoId: String(row.producto_id),
      nombre: String(nombre ?? 'Producto'),
      cantidad: Number(row.cantidad ?? 0),
      precioUnitario: Number(row.precio_unitario ?? 0),
    })
    porVenta.set(vid, acc)
  }
  return data.map((r) => {
    const id = String(r.id)
    const num = r.numero_venta ? String(r.numero_venta) : id.slice(0, 8)
    const cli = r.cliente_nombre ? String(r.cliente_nombre) : 'Sin cliente'
    return {
      id,
      label: `${num} · ${cli}`,
      items: porVenta.get(id) ?? [],
    }
  })
}

export async function listarDevoluciones(
  client: SupabaseClient,
  input: { tipo: string; estado: string; desde: string; hasta: string },
): Promise<{ filas: DevolucionFila[]; error: string | null }> {
  let q = client
    .from('devoluciones')
    .select('id, numero, tipo, estado, fecha, venta_id, motivo, ventas(numero_venta, cliente_nombre)')
    .is('deleted_at', null)
    .order('fecha', { ascending: false })
    .limit(200)
  if (input.tipo) q = q.eq('tipo', input.tipo)
  if (input.estado) q = q.eq('estado', input.estado)
  if (input.desde) q = q.gte('fecha', `${input.desde}T00:00:00.000-03:00`)
  if (input.hasta) q = q.lte('fecha', `${input.hasta}T23:59:59.999-03:00`)
  const { data, error } = await q
  if (error) {
    if (sqlFalta(error.message)) {
      return {
        filas: [],
        error: 'Falta crear devoluciones. Pegá supabase/067_devoluciones.sql (rol postgres) y recargá.',
      }
    }
    return { filas: [], error: error.message }
  }
  const ids = (data ?? []).map((r) => String(r.id))
  const itemsRes =
    ids.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await client
          .from('devoluciones_items')
          .select('devolucion_id, cantidad, tipo, productos(nombre)')
          .in('devolucion_id', ids)
  const textos = new Map<string, string[]>()
  for (const row of (itemsRes.data ?? []) as Record<string, unknown>[]) {
    const did = String(row.devolucion_id)
    const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
    const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
    const lado = row.tipo === 'entregado' ? 'lleva' : 'trae'
    const acc = textos.get(did) ?? []
    acc.push(`${nombre ?? 'Producto'} × ${row.cantidad} (${lado})`)
    textos.set(did, acc)
  }
  return {
    filas: (data ?? []).map((row) => {
      const v = row.ventas as { numero_venta?: string; cliente_nombre?: string } | { numero_venta?: string; cliente_nombre?: string }[] | null
      const venta = Array.isArray(v) ? v[0] : v
      const ventaLabel = venta
        ? `${venta.numero_venta ?? 'Venta'} · ${venta.cliente_nombre ?? 'Sin cliente'}`
        : null
      return {
        id: String(row.id),
        numero: row.numero == null ? null : Number(row.numero),
        tipo: (row.tipo === 'cambio' ? 'cambio' : 'devolucion') as TipoDevolucion,
        estado: (['pendiente', 'procesado', 'cancelado'].includes(String(row.estado))
          ? row.estado
          : 'pendiente') as EstadoDevolucion,
        fecha: String(row.fecha ?? ''),
        ventaId: row.venta_id ? String(row.venta_id) : null,
        ventaLabel,
        productos: (textos.get(String(row.id)) ?? []).join(', ') || '—',
        motivo: row.motivo ? String(row.motivo) : null,
      }
    }),
    error: null,
  }
}

export async function obtenerDevolucion(
  client: SupabaseClient,
  id: string,
): Promise<{ data: DevolucionFicha | null; error: string | null }> {
  const { data, error } = await client
    .from('devoluciones')
    .select('id, numero, tipo, estado, fecha, venta_id, motivo, notas, ventas(numero_venta, cliente_nombre)')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (sqlFalta(error.message)) {
      return {
        data: null,
        error: 'Falta crear devoluciones. Pegá supabase/067_devoluciones.sql (rol postgres) y recargá.',
      }
    }
    return { data: null, error: error.message }
  }
  if (!data) return { data: null, error: 'No se encontró el registro' }
  const itemsRes = await client
    .from('devoluciones_items')
    .select('id, producto_id, cantidad, precio_unitario, tipo, productos(nombre)')
    .eq('devolucion_id', id)
  const movRes = await client
    .from('movimientos_inventario')
    .select('id, tipo, cantidad, signo, fecha')
    .eq('referencia_id', id)
    .is('deleted_at', null)
    .order('fecha', { ascending: true })
  const v = data.ventas as { numero_venta?: string; cliente_nombre?: string } | { numero_venta?: string; cliente_nombre?: string }[] | null
  const venta = Array.isArray(v) ? v[0] : v
  return {
    data: {
      id: String(data.id),
      numero: data.numero == null ? null : Number(data.numero),
      tipo: data.tipo === 'cambio' ? 'cambio' : 'devolucion',
      estado: (['pendiente', 'procesado', 'cancelado'].includes(String(data.estado))
        ? data.estado
        : 'pendiente') as EstadoDevolucion,
      fecha: String(data.fecha ?? ''),
      ventaId: data.venta_id ? String(data.venta_id) : null,
      ventaLabel: venta ? `${venta.numero_venta ?? 'Venta'} · ${venta.cliente_nombre ?? 'Sin cliente'}` : null,
      motivo: data.motivo ? String(data.motivo) : null,
      notas: data.notas ? String(data.notas) : null,
      items: ((itemsRes.data ?? []) as Record<string, unknown>[]).map((row) => {
        const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
        const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
        return {
          id: String(row.id),
          productoId: String(row.producto_id),
          nombre: String(nombre ?? 'Producto'),
          cantidad: Number(row.cantidad ?? 0),
          precioUnitario: Number(row.precio_unitario ?? 0),
          tipo: row.tipo === 'entregado' ? 'entregado' : 'devuelto',
        }
      }),
      movimientos: ((movRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        tipo: String(row.tipo ?? ''),
        cantidad: Number(row.cantidad ?? 0),
        signo: Number(row.signo ?? 0),
        fecha: String(row.fecha ?? ''),
      })),
    },
    error: null,
  }
}

export async function registrarDevolucion(
  client: SupabaseClient,
  input: {
    tipo: TipoDevolucion
    ventaId: string | null
    motivo: string
    notas: string
    items: ItemDevolucionInput[]
  },
): Promise<{ id: string | null; error: string | null }> {
  const payload = input.items.map((i) => ({
    producto_id: i.productoId,
    variante_id: i.varianteId ?? null,
    cantidad: i.cantidad,
    precio_unitario: i.precioUnitario,
    tipo: i.tipo,
  }))
  const { data, error } = await client.rpc('registrar_devolucion', {
    p_tipo: input.tipo,
    p_venta_id: input.ventaId,
    p_motivo: input.motivo,
    p_notas: input.notas,
    p_items: payload,
  })
  if (!error) return { id: data ? String(data) : null, error: null }
  if (sqlFalta(error.message)) {
    return {
      id: null,
      error: 'Falta crear devoluciones. Pegá supabase/067_devoluciones.sql (rol postgres) y recargá.',
    }
  }
  if (error.message.includes('ITEMS_OBLIGATORIOS')) return { id: null, error: 'Agregá al menos un producto' }
  if (error.message.includes('ITEM_INVALIDO')) return { id: null, error: 'Revisá cantidades y productos' }
  return { id: null, error: error.message }
}

export async function cancelarDevolucion(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client.rpc('cancelar_devolucion', { p_id: id })
  if (!error) return null
  if (sqlFalta(error.message)) {
    return 'Falta crear devoluciones. Pegá supabase/067_devoluciones.sql (rol postgres) y recargá.'
  }
  if (error.message.includes('DEVOLUCION_INVALIDA')) return 'Solo se puede cancelar si está pendiente'
  return error.message
}

export function formatoFechaDevolucion(iso: string) {
  return formatoFechaHora(iso)
}
