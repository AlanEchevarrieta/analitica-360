import type { SupabaseClient } from '@supabase/supabase-js'

export const CONDICIONES_AFIP = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
] as const

export const CONDICIONES_PAGO = [
  'Contado',
  '15 días',
  '30 días',
  '60 días',
  'Consignación',
  'Otro',
] as const

export const FORMAS_PAGO_ACEPTADAS = ['Transferencia', 'Efectivo', 'Cheque', 'Mercado Pago'] as const

const COLS_BASICAS =
  'id, nombre, contacto, telefono, email, productos_que_provee, condiciones_pago, notas, activo'

const COLS = `${COLS_BASICAS}, razon_social, nombre_comercial, cuit, condicion_afip, nombre_vendedor, formas_pago_aceptadas, plazo_entrega, cbu, alias_cbu, banco`

export type ProveedorFila = {
  id: string
  nombre: string
  razon_social: string | null
  nombre_comercial: string | null
  cuit: string | null
  condicion_afip: string | null
  nombre_vendedor: string | null
  telefono: string | null
  email: string | null
  productos_que_provee: string | null
  condiciones_pago: string | null
  formas_pago_aceptadas: string[]
  plazo_entrega: string | null
  cbu: string | null
  alias_cbu: string | null
  banco: string | null
  notas: string | null
  activo: boolean
}

export type ProveedorInput = {
  razonSocial: string
  nombreComercial: string
  cuit: string
  condicionAfip: string
  telefono: string
  email: string
  nombreVendedor: string
  productosQueProvee: string
  condicionesPago: string
  formasPagoAceptadas: string[]
  plazoEntrega: string
  cbu: string
  aliasCbu: string
  banco: string
  notas: string
  activo: boolean
}

export type CompraProveedor = {
  id: string
  fecha: string
  productos: string
  total: number
  notas: string | null
}

function txt(v: unknown) {
  if (v == null || v === '') return null
  return String(v)
}

function mensajeSql(msg: string) {
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta actualizar proveedores en Supabase. Pegá TODO supabase/023_proveedores_campos.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export function etiquetaProveedor(p: {
  nombre: string
  razon_social?: string | null
  nombre_comercial?: string | null
}) {
  return (p.nombre_comercial || p.razon_social || p.nombre).trim()
}

export function formatCuit(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

export function formatCbu(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 22)
}

function mapFila(row: Record<string, unknown>): ProveedorFila {
  const formas = row.formas_pago_aceptadas
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    razon_social: txt(row.razon_social) ?? txt(row.nombre),
    nombre_comercial: txt(row.nombre_comercial),
    cuit: txt(row.cuit),
    condicion_afip: txt(row.condicion_afip),
    nombre_vendedor: txt(row.nombre_vendedor) ?? txt(row.contacto),
    telefono: txt(row.telefono),
    email: txt(row.email),
    productos_que_provee: txt(row.productos_que_provee),
    condiciones_pago: txt(row.condiciones_pago),
    formas_pago_aceptadas: Array.isArray(formas) ? formas.map(String) : [],
    plazo_entrega: txt(row.plazo_entrega),
    cbu: txt(row.cbu),
    alias_cbu: txt(row.alias_cbu),
    banco: txt(row.banco),
    notas: txt(row.notas),
    activo: Boolean(row.activo),
  }
}

function payloadRpc(input: ProveedorInput) {
  return {
    razon_social: input.razonSocial,
    nombre_comercial: input.nombreComercial,
    cuit: input.cuit,
    condicion_afip: input.condicionAfip,
    telefono: input.telefono,
    email: input.email,
    nombre_vendedor: input.nombreVendedor,
    productos_que_provee: input.productosQueProvee,
    condiciones_pago: input.condicionesPago,
    formas_pago_aceptadas: input.formasPagoAceptadas,
    plazo_entrega: input.plazoEntrega,
    cbu: input.cbu,
    alias_cbu: input.aliasCbu,
    banco: input.banco,
    notas: input.notas,
    activo: input.activo,
  }
}

export async function listarProveedoresPaginado(
  client: SupabaseClient,
  input: { pagina: number; pageSize: number; busqueda: string },
): Promise<{ filas: ProveedorFila[]; total: number; error: string | null }> {
  const from = (input.pagina - 1) * input.pageSize
  const to = from + input.pageSize - 1
  const q = input.busqueda.trim().replace(/,/g, ' ')

  let query = client
    .from('proveedores')
    .select(COLS, { count: 'exact' })
    .is('deleted_at', null)
    .order('nombre', { ascending: true })

  if (q) {
    query = query.or(
      `nombre.ilike.%${q}%,razon_social.ilike.%${q}%,nombre_comercial.ilike.%${q}%`,
    )
  }

  let { data, error, count } = await query.range(from, to)
  if (error) {
    let q2 = client
      .from('proveedores')
      .select(COLS_BASICAS, { count: 'exact' })
      .is('deleted_at', null)
      .order('nombre', { ascending: true })
    if (q) q2 = q2.ilike('nombre', `%${q}%`)
    const retry = await q2.range(from, to)
    if (retry.error) return { filas: [], total: 0, error: mensajeSql(error.message) }
    data = retry.data as typeof data
    count = retry.count
    error = null
  }
  return {
    filas: ((data ?? []) as Record<string, unknown>[]).map(mapFila),
    total: count ?? 0,
    error: null,
  }
}

export async function listarProveedoresEmpresa(
  client: SupabaseClient,
): Promise<{ filas: ProveedorFila[]; error: string | null }> {
  const { data, error } = await client
    .from('proveedores')
    .select(COLS)
    .is('deleted_at', null)
    .order('nombre', { ascending: true })
  if (error) {
    const retry = await client
      .from('proveedores')
      .select(COLS_BASICAS)
      .is('deleted_at', null)
      .order('nombre', { ascending: true })
    if (retry.error) return { filas: [], error: mensajeSql(error.message) }
    return { filas: ((retry.data ?? []) as Record<string, unknown>[]).map(mapFila), error: null }
  }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapFila), error: null }
}

export async function obtenerProveedor(
  client: SupabaseClient,
  id: string,
): Promise<{ fila: ProveedorFila | null; error: string | null }> {
  const { data, error } = await client
    .from('proveedores')
    .select(COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { fila: null, error: mensajeSql(error.message) }
  if (!data) return { fila: null, error: 'No se encontró el proveedor' }
  return { fila: mapFila(data as Record<string, unknown>), error: null }
}

export async function obtenerFichaProveedor(
  client: SupabaseClient,
  id: string,
): Promise<{
  fila: ProveedorFila | null
  compras: CompraProveedor[]
  error: string | null
}> {
  const { fila, error } = await obtenerProveedor(client, id)
  if (error || !fila) return { fila: null, compras: [], error: error ?? 'No se encontró el proveedor' }

  const tabla = await client
    .from('compras')
    .select('id, fecha, total, notas, compras_items(producto_nombre, cantidad)')
    .eq('proveedor_id', id)
    .is('deleted_at', null)
    .order('fecha', { ascending: false })

  if (tabla.error) {
    return { fila, compras: [], error: mensajeSql(tabla.error.message) }
  }

  const compras = ((tabla.data ?? []) as Record<string, unknown>[]).map((row) => {
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
      productos,
      total: Number(row.total ?? 0),
      notas: txt(row.notas),
    }
  })

  return { fila, compras, error: null }
}

export async function crearProveedor(
  client: SupabaseClient,
  input: ProveedorInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client.rpc('crear_proveedor', { p_datos: payloadRpc(input) })
  if (error) return { id: null, error: mensajeSql(error.message) }
  return { id: data ? String(data) : null, error: null }
}

export async function actualizarProveedor(
  client: SupabaseClient,
  id: string,
  input: ProveedorInput,
): Promise<string | null> {
  const { error } = await client.rpc('actualizar_proveedor', {
    p_id: id,
    p_datos: payloadRpc(input),
  })
  return error ? mensajeSql(error.message) : null
}
