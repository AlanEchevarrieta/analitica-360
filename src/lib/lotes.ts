import type { SupabaseClient } from '@supabase/supabase-js'
import { fechaHoyAR, sumarDiasIso } from './analytics'
import { slugSku } from './variantes'

export type EstadoLote = 'vencido' | 'por_vencer' | 'vigente' | 'sin_vencimiento'

export type LoteFila = {
  id: string
  productoId: string
  productoNombre: string
  varianteId: string | null
  varianteEtiqueta: string | null
  numeroLote: string
  fechaVencimiento: string | null
  fechaElaboracion: string | null
  cantidadInicial: number
  stock: number
  proveedorId: string | null
  proveedorNombre: string | null
  notas: string | null
  activo: boolean
  estado: EstadoLote
}

export function sugerenciaNumeroLote(nombreProducto: string, isoFecha = fechaHoyAR()) {
  const [y, m] = isoFecha.split('-')
  const slug = slugSku(nombreProducto) || 'PROD'
  return `LOTE-${y}${m}-${slug}`
}

export function estadoLote(fechaVencimiento: string | null, hoy = fechaHoyAR()): EstadoLote {
  if (!fechaVencimiento) return 'sin_vencimiento'
  if (fechaVencimiento < hoy) return 'vencido'
  if (fechaVencimiento <= sumarDiasIso(hoy, 29)) return 'por_vencer'
  return 'vigente'
}

export function etiquetaEstadoLote(estado: EstadoLote) {
  if (estado === 'vencido') return { icono: '🔴', texto: 'Vencido' }
  if (estado === 'por_vencer') return { icono: '🟡', texto: 'Por vencer' }
  if (estado === 'vigente') return { icono: '🟢', texto: 'Vigente' }
  return { icono: '⚪', texto: 'Sin vencimiento' }
}

export function formatoFechaLote(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function msgSql(msg: string) {
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('does not exist') || t.includes('lote')) {
    return 'Falta el módulo de lotes. Pegá TODO supabase/046_lotes.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export async function stockPorLote(client: SupabaseClient, loteIds: string[]) {
  const map = new Map<string, number>()
  if (loteIds.length === 0) return map
  const { data, error } = await client
    .from('movimientos_inventario')
    .select('lote_id, cantidad, signo, tipo')
    .in('lote_id', loteIds)
    .is('deleted_at', null)
  if (error || !data) return map
  for (const row of data as Record<string, unknown>[]) {
    if (String(row.tipo ?? '') === 'transferencia') continue
    const id = String(row.lote_id ?? '')
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + Number(row.cantidad ?? 0) * Number(row.signo ?? 0))
  }
  return map
}

export async function listarLotes(
  client: SupabaseClient,
  input?: { productoId?: string; proveedorId?: string },
): Promise<{ filas: LoteFila[]; error: string | null }> {
  let q = client
    .from('lotes')
    .select(
      'id, producto_id, variante_id, numero_lote, fecha_vencimiento, fecha_elaboracion, cantidad_inicial, proveedor_id, notas, activo, productos(nombre), producto_variantes(atributos), proveedores(nombre)',
    )
    .eq('activo', true)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (input?.productoId) q = q.eq('producto_id', input.productoId)
  if (input?.proveedorId) q = q.eq('proveedor_id', input.proveedorId)
  const { data, error } = await q
  if (error) return { filas: [], error: msgSql(error.message) }
  const rows = (data ?? []) as Record<string, unknown>[]
  const stocks = await stockPorLote(
    client,
    rows.map((r) => String(r.id)),
  )
  const hoy = fechaHoyAR()
  const filas: LoteFila[] = rows.map((row) => {
    const prod = row.productos as { nombre?: string } | null
    const vari = row.producto_variantes as { atributos?: Record<string, string> } | null
    const prov = row.proveedores as { nombre?: string } | null
    const attrs = vari?.atributos ?? {}
    const varianteEtiqueta = Object.values(attrs).filter(Boolean).join('/') || null
    const venc = row.fecha_vencimiento ? String(row.fecha_vencimiento).slice(0, 10) : null
    const elab = row.fecha_elaboracion ? String(row.fecha_elaboracion).slice(0, 10) : null
    const id = String(row.id)
    const cantidadInicial = Number(row.cantidad_inicial ?? 0)
    const stock = stocks.has(id) ? stocks.get(id)! : cantidadInicial
    return {
      id,
      productoId: String(row.producto_id),
      productoNombre: String(prod?.nombre ?? ''),
      varianteId: row.variante_id == null ? null : String(row.variante_id),
      varianteEtiqueta,
      numeroLote: String(row.numero_lote ?? ''),
      fechaVencimiento: venc,
      fechaElaboracion: elab,
      cantidadInicial,
      stock,
      proveedorId: row.proveedor_id == null ? null : String(row.proveedor_id),
      proveedorNombre: prov?.nombre ? String(prov.nombre) : null,
      notas: row.notas == null || row.notas === '' ? null : String(row.notas),
      activo: row.activo !== false,
      estado: estadoLote(venc, hoy),
    }
  })
  return { filas, error: null }
}

export async function lotesDisponiblesProducto(
  client: SupabaseClient,
  productoId: string,
  varianteId?: string | null,
): Promise<LoteFila[]> {
  const { filas, error } = await listarLotes(client, { productoId })
  if (error) return []
  const mismaVar = filas.filter((l) => {
    if (varianteId) return l.varianteId === varianteId
    return !l.varianteId
  })
  return mismaVar
    .filter((l) => l.stock > 0)
    .sort((a, b) => {
      if (!a.fechaVencimiento && !b.fechaVencimiento) return 0
      if (!a.fechaVencimiento) return 1
      if (!b.fechaVencimiento) return -1
      return a.fechaVencimiento.localeCompare(b.fechaVencimiento)
    })
}

export async function contarAlertasLotes(client: SupabaseClient) {
  const { filas, error } = await listarLotes(client)
  if (error) return { vencidos: 0, porVencer: 0 }
  return {
    vencidos: filas.filter((l) => l.estado === 'vencido' && l.stock > 0).length,
    porVencer: filas.filter((l) => l.estado === 'por_vencer' && l.stock > 0).length,
  }
}

export async function crearLote(
  client: SupabaseClient,
  input: {
    empresaId: string
    productoId: string
    varianteId?: string | null
    numeroLote: string
    fechaVencimiento?: string | null
    fechaElaboracion?: string | null
    cantidadInicial: number
    proveedorId?: string | null
    notas?: string | null
    registrarMovimiento?: boolean
  },
): Promise<{ id: string | null; error: string | null }> {
  const numero = input.numeroLote.trim()
  if (!numero) return { id: null, error: 'El número de lote es obligatorio' }
  const { data, error } = await client
    .from('lotes')
    .insert({
      empresa_id: input.empresaId,
      producto_id: input.productoId,
      variante_id: input.varianteId ?? null,
      numero_lote: numero,
      fecha_vencimiento: input.fechaVencimiento || null,
      fecha_elaboracion: input.fechaElaboracion || null,
      cantidad_inicial: input.cantidadInicial,
      proveedor_id: input.proveedorId || null,
      notas: input.notas?.trim() || null,
      activo: true,
    })
    .select('id')
    .maybeSingle()
  if (error) return { id: null, error: msgSql(error.message) }
  const id = data ? String((data as { id: string }).id) : null
  if (!id) return { id: null, error: 'No se pudo crear el lote' }
  if (input.registrarMovimiento && input.cantidadInicial > 0) {
    const { data: auth } = await client.auth.getUser()
    const uid = auth.user?.id
    if (uid) {
      const { error: movError } = await client.from('movimientos_inventario').insert({
        empresa_id: input.empresaId,
        producto_id: input.productoId,
        usuario_id: uid,
        tipo: 'ajuste_positivo',
        cantidad: input.cantidadInicial,
        signo: 1,
        motivo: `Lote ${numero}`,
        variante_id: input.varianteId ?? null,
        lote_id: id,
      })
      if (movError) return { id, error: msgSql(movError.message) }
    }
  }
  return { id, error: null }
}

export function etiquetaLoteOpcion(lote: LoteFila) {
  const vence = lote.fechaVencimiento ? `Vence ${formatoFechaLote(lote.fechaVencimiento)}` : 'Sin vencimiento'
  return `Lote ${lote.numeroLote} · ${vence} · Stock: ${lote.stock}u`
}
