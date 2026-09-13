import type { SupabaseClient } from '@supabase/supabase-js'
import { formatoARS } from './productos'
import { etiquetaCombo } from './variantes'

export type EstadoPedido =
  | 'nuevo'
  | 'en_preparacion'
  | 'listo_despacho'
  | 'despachado'
  | 'con_transportista'
  | 'entregado'
  | 'cancelado'

export type OrigenPedido = 'manual' | 'tienda_online' | 'importacion'

export type PedidoFila = {
  id: string
  numeroPedido: string
  clienteNombre: string
  origen: OrigenPedido
  estado: EstadoPedido
  total: number
  createdAt: string
}

export type PedidoItemFicha = {
  id: string
  productoId: string
  varianteId: string | null
  loteId: string | null
  nombre: string
  codigoBarra: string
  sku: string
  varianteEtiqueta: string
  numeroLote: string
  cantidad: number
  precioUnitario: number
  cantidadPreparada: number
  preparado: boolean
}

export type PedidoFicha = {
  id: string
  numeroPedido: string
  clienteId: string | null
  clienteNombre: string
  clienteEmail: string
  clienteTelefono: string
  origen: OrigenPedido
  estado: EstadoPedido
  direccionEnvio: string
  codigoPostal: string
  localidad: string
  provincia: string
  metodoEnvio: string
  numeroSeguimiento: string
  transportista: string
  notas: string
  total: number
  createdAt: string
  items: PedidoItemFicha[]
}

export const ESTADOS_PEDIDO: { id: EstadoPedido; label: string }[] = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'en_preparacion', label: 'En preparación' },
  { id: 'listo_despacho', label: 'Listo para despacho' },
  { id: 'despachado', label: 'Despachado' },
  { id: 'con_transportista', label: 'Con transportista' },
  { id: 'entregado', label: 'Entregado' },
  { id: 'cancelado', label: 'Cancelado' },
]

export const ORIGENES_PEDIDO: { id: OrigenPedido; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'tienda_online', label: 'Tienda online' },
  { id: 'importacion', label: 'Importación' },
]

export const METODOS_ENVIO = [
  'Retiro en local',
  'Andreani',
  'OCA',
  'Correo Argentino',
  'Otro',
] as const

export const TRANSPORTISTAS = METODOS_ENVIO

export const PROVINCIAS_AR = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

const ESTADO_STYLE: Record<EstadoPedido, { bg: string; fg: string }> = {
  nuevo: { bg: 'rgba(99,102,241,0.18)', fg: '#6366F1' },
  en_preparacion: { bg: 'rgba(252,211,77,0.18)', fg: '#FCD34D' },
  listo_despacho: { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B' },
  despachado: { bg: 'rgba(59,130,246,0.18)', fg: '#3B82F6' },
  con_transportista: { bg: 'rgba(14,165,233,0.18)', fg: '#0EA5E9' },
  entregado: { bg: 'rgba(74,222,128,0.16)', fg: '#4ADE80' },
  cancelado: { bg: 'rgba(248,113,113,0.18)', fg: '#F87171' },
}

export function etiquetaEstadoPedido(estado: EstadoPedido) {
  return ESTADOS_PEDIDO.find((e) => e.id === estado)?.label ?? estado
}

export function etiquetaOrigenPedido(origen: OrigenPedido) {
  return ORIGENES_PEDIDO.find((o) => o.id === origen)?.label ?? origen
}

export function estiloEstadoPedido(estado: EstadoPedido) {
  return ESTADO_STYLE[estado] ?? ESTADO_STYLE.nuevo
}

export function etiquetaItemPedido(item: PedidoItemFicha) {
  return [item.nombre, item.varianteEtiqueta].filter(Boolean).join(' ')
}

export function itemPickingCompleto(item: PedidoItemFicha) {
  return item.cantidadPreparada === item.cantidad && item.cantidad > 0
}

export function itemsPorCodigoBarras(items: PedidoItemFicha[], codigo: string) {
  const q = codigo.trim().toLowerCase()
  if (!q) return []
  return items.filter((i) => {
    const barra = i.codigoBarra.trim().toLowerCase()
    const sku = i.sku.trim().toLowerCase()
    return barra === q || sku === q
  })
}

export function itemPorCodigoBarras(items: PedidoItemFicha[], codigo: string) {
  return itemsPorCodigoBarras(items, codigo)[0] ?? null
}

export function resumenPicking(items: PedidoItemFicha[]) {
  const itemsListos = items.filter(itemPickingCompleto).length
  const unidadesPrep = items.reduce((acc, i) => acc + Math.max(0, i.cantidadPreparada), 0)
  const unidadesTot = items.reduce((acc, i) => acc + i.cantidad, 0)
  return {
    itemsListos,
    itemsTot: items.length,
    unidadesPrep,
    unidadesTot,
    incompletos: items.filter((i) => i.cantidadPreparada !== i.cantidad),
  }
}

export function textoIncompletosPicking(items: PedidoItemFicha[]) {
  const faltan = resumenPicking(items).incompletos
  if (faltan.length === 0) return null
  return `Faltan preparar:\n${faltan
    .map((i) => `  · ${etiquetaItemPedido(i)}: ${i.cantidadPreparada}/${i.cantidad} unidades`)
    .join('\n')}`
}

export function formatoFechaPedido(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatoFechaRemito(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function armarDireccionEnvio(input: {
  calle: string
  altura: string
  entreCalles: string
  piso: string
  codigoPostal: string
  localidad: string
  provincia: string
}) {
  const partes: string[] = []
  const calleAltura = [input.calle.trim(), input.altura.trim()].filter(Boolean).join(' ')
  if (calleAltura) partes.push(calleAltura)
  if (input.entreCalles.trim()) partes.push(`entre ${input.entreCalles.trim()}`)
  if (input.piso.trim()) partes.push(input.piso.trim())
  const loc = [input.codigoPostal.trim() ? `(${input.codigoPostal.trim()})` : '', input.localidad.trim()]
    .filter(Boolean)
    .join(' ')
  if (loc) partes.push(loc)
  if (input.provincia.trim()) partes.push(input.provincia.trim())
  return partes.join(', ')
}

export function urlSeguimiento(transportista: string, numero: string) {
  const n = numero.trim()
  if (!n) return null
  const t = transportista.trim().toLowerCase()
  if (t.includes('andreani')) return `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(n)}`
  if (t === 'oca' || t.includes('oca')) return `https://www.oca.com.ar/seguimiento/?numero=${encodeURIComponent(n)}`
  if (t.includes('correo')) {
    return `https://www.correoargentino.com.ar/formularios/one?id=${encodeURIComponent(n)}`
  }
  return null
}

export function redactarEmailDespacho(input: {
  ficha: PedidoFicha
  empresa: string
  remitenteNombre: string
  remitenteDireccion: string
}) {
  const ficha = input.ficha
  const link = urlSeguimiento(ficha.transportista || ficha.metodoEnvio, ficha.numeroSeguimiento)
  const detalle = ficha.items
    .map((it) => {
      const desc = [it.nombre, it.varianteEtiqueta].filter(Boolean).join(' ')
      return `- ${it.cantidad}x ${desc} — ${formatoARS(it.cantidad * it.precioUnitario)}`
    })
    .join('\n')
  const firma = [input.empresa, input.remitenteDireccion].filter(Boolean).join(' — ') || input.empresa
  const asunto = `Tu pedido ${ficha.numeroPedido} fue despachado 📦`
  const cuerpo = `Hola ${ficha.clienteNombre || ''},

Tu pedido está en camino 🚚

Transportista: ${ficha.transportista || ficha.metodoEnvio || '—'}
N° de seguimiento: ${ficha.numeroSeguimiento || '—'}
${link ? `Seguí tu envío: ${link}` : ''}

Detalle del pedido:
${detalle}

¡Gracias por tu compra!
${firma}`.replace(/\n{3,}/g, '\n\n')
  return { asunto, cuerpo }
}

function msgSql(msg: string) {
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('does not exist') || t.includes('pedidos')) {
    return 'Falta el módulo de pedidos. Pegá TODO supabase/052_pedidos.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

function esEstado(v: string): v is EstadoPedido {
  return ESTADOS_PEDIDO.some((e) => e.id === v)
}

function esOrigen(v: string): v is OrigenPedido {
  return ORIGENES_PEDIDO.some((o) => o.id === v)
}

function mapFila(row: Record<string, unknown>): PedidoFila {
  const origen = String(row.origen ?? 'manual')
  const estado = String(row.estado ?? 'nuevo')
  return {
    id: String(row.id),
    numeroPedido: String(row.numero_pedido ?? ''),
    clienteNombre: String(row.cliente_nombre ?? '—'),
    origen: esOrigen(origen) ? origen : 'manual',
    estado: esEstado(estado) ? estado : 'nuevo',
    total: Number(row.total ?? 0),
    createdAt: String(row.created_at ?? ''),
  }
}

function attrsVariante(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v != null && String(v).trim()) out[k] = String(v)
  }
  return out
}

export async function listarPedidosPaginado(
  client: SupabaseClient,
  input: {
    pagina: number
    pageSize: number
    estado: EstadoPedido | ''
    origen: OrigenPedido | ''
  },
): Promise<{ filas: PedidoFila[]; total: number; error: string | null }> {
  const from = (input.pagina - 1) * input.pageSize
  const to = from + input.pageSize - 1
  let q = client
    .from('pedidos')
    .select(
      'id, numero_pedido, cliente_nombre, origen, estado, total, created_at',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (input.estado) q = q.eq('estado', input.estado)
  if (input.origen) q = q.eq('origen', input.origen)
  const { data, error, count } = await q
  if (error) return { filas: [], total: 0, error: msgSql(error.message) }
  return {
    filas: ((data ?? []) as Record<string, unknown>[]).map(mapFila),
    total: count ?? 0,
    error: null,
  }
}

export async function contarPedidosNuevos(client: SupabaseClient) {
  const { count, error } = await client
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'nuevo')
    .is('deleted_at', null)
  if (error) return 0
  return count ?? 0
}

export async function crearPedido(
  client: SupabaseClient,
  input: {
    empresaId: string
    clienteId: string | null
    clienteNombre: string
    clienteEmail: string
    clienteTelefono: string
    direccionEnvio: string
    codigoPostal: string
    localidad: string
    provincia: string
    metodoEnvio: string
    notas: string
    items: {
      productoId: string
      varianteId: string | null
      loteId: string | null
      cantidad: number
      precioUnitario: number
    }[]
  },
): Promise<{ id: string | null; numeroPedido: string | null; error: string | null }> {
  if (input.items.length === 0) return { id: null, numeroPedido: null, error: 'Agregá al menos un producto' }
  const total = input.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0)
  const { data, error } = await client
    .from('pedidos')
    .insert({
      empresa_id: input.empresaId,
      cliente_id: input.clienteId,
      cliente_nombre: input.clienteNombre.trim() || null,
      cliente_email: input.clienteEmail.trim() || null,
      cliente_telefono: input.clienteTelefono.trim() || null,
      origen: 'manual',
      estado: 'nuevo',
      direccion_envio: input.direccionEnvio.trim() || null,
      codigo_postal: input.codigoPostal.trim() || null,
      localidad: input.localidad.trim() || null,
      provincia: input.provincia.trim() || null,
      metodo_envio: input.metodoEnvio.trim() || null,
      notas: input.notas.trim() || null,
      total,
    })
    .select('id, numero_pedido')
    .single()
  if (error || !data) {
    return { id: null, numeroPedido: null, error: msgSql(error?.message ?? 'No se pudo crear el pedido') }
  }
  const pedidoId = String((data as { id: string }).id)
  const numeroPedido = String((data as { numero_pedido?: string }).numero_pedido ?? '')
  const { error: itemsError } = await client.from('pedidos_items').insert(
    input.items.map((i) => ({
      pedido_id: pedidoId,
      producto_id: i.productoId,
      variante_id: i.varianteId,
      lote_id: i.loteId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
      cantidad_preparada: 0,
      preparado: false,
    })),
  )
  if (itemsError) {
    await client.from('pedidos').update({ deleted_at: new Date().toISOString() }).eq('id', pedidoId)
    return { id: null, numeroPedido: null, error: msgSql(itemsError.message) }
  }
  return { id: pedidoId, numeroPedido, error: null }
}

export async function obtenerFichaPedido(
  client: SupabaseClient,
  id: string,
): Promise<{ ficha: PedidoFicha | null; error: string | null }> {
  const { data, error } = await client
    .from('pedidos')
    .select(
      'id, numero_pedido, cliente_id, cliente_nombre, cliente_email, cliente_telefono, origen, estado, direccion_envio, codigo_postal, localidad, provincia, metodo_envio, numero_seguimiento, transportista, notas, total, created_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { ficha: null, error: msgSql(error.message) }
  if (!data) return { ficha: null, error: 'Pedido no encontrado' }
  const row = data as Record<string, unknown>
  const { data: itemsRaw, error: itemsError } = await client
    .from('pedidos_items')
    .select(
      'id, producto_id, variante_id, lote_id, cantidad, precio_unitario, cantidad_preparada, preparado, productos(nombre, codigo_barra), producto_variantes(atributos, sku), lotes(numero_lote)',
    )
    .eq('pedido_id', id)
  if (itemsError) return { ficha: null, error: msgSql(itemsError.message) }

  const items: PedidoItemFicha[] = ((itemsRaw ?? []) as Record<string, unknown>[]).map((it) => {
    const prod = it.productos as
      | { nombre?: string; codigo_barra?: string }
      | { nombre?: string; codigo_barra?: string }[]
      | null
    const prodRow = Array.isArray(prod) ? prod[0] : prod
    const vari = it.producto_variantes as
      | { atributos?: unknown; sku?: string }
      | { atributos?: unknown; sku?: string }[]
      | null
    const variRow = Array.isArray(vari) ? vari[0] : vari
    const lote = it.lotes as { numero_lote?: string } | { numero_lote?: string }[] | null
    const nLote = Array.isArray(lote) ? lote[0]?.numero_lote : lote?.numero_lote
    return {
      id: String(it.id),
      productoId: String(it.producto_id),
      varianteId: it.variante_id == null ? null : String(it.variante_id),
      loteId: it.lote_id == null ? null : String(it.lote_id),
      nombre: String(prodRow?.nombre ?? 'Producto'),
      codigoBarra: String(prodRow?.codigo_barra ?? ''),
      sku: String(variRow?.sku ?? ''),
      varianteEtiqueta: etiquetaCombo(attrsVariante(variRow?.atributos)),
      numeroLote: String(nLote ?? ''),
      cantidad: Number(it.cantidad ?? 0),
      precioUnitario: Number(it.precio_unitario ?? 0),
      cantidadPreparada: Number(it.cantidad_preparada ?? 0),
      preparado: Boolean(it.preparado),
    }
  })

  const origen = String(row.origen ?? 'manual')
  const estado = String(row.estado ?? 'nuevo')
  return {
    ficha: {
      id: String(row.id),
      numeroPedido: String(row.numero_pedido ?? ''),
      clienteId: row.cliente_id == null ? null : String(row.cliente_id),
      clienteNombre: String(row.cliente_nombre ?? ''),
      clienteEmail: String(row.cliente_email ?? ''),
      clienteTelefono: String(row.cliente_telefono ?? ''),
      origen: esOrigen(origen) ? origen : 'manual',
      estado: esEstado(estado) ? estado : 'nuevo',
      direccionEnvio: String(row.direccion_envio ?? ''),
      codigoPostal: String(row.codigo_postal ?? ''),
      localidad: String(row.localidad ?? ''),
      provincia: String(row.provincia ?? ''),
      metodoEnvio: String(row.metodo_envio ?? ''),
      numeroSeguimiento: String(row.numero_seguimiento ?? ''),
      transportista: String(row.transportista ?? ''),
      notas: String(row.notas ?? ''),
      total: Number(row.total ?? 0),
      createdAt: String(row.created_at ?? ''),
      items,
    },
    error: null,
  }
}

export async function guardarItemPreparacion(
  client: SupabaseClient,
  item: { id: string; preparado: boolean; cantidadPreparada: number },
): Promise<string | null> {
  const { error } = await client
    .from('pedidos_items')
    .update({
      preparado: item.preparado,
      cantidad_preparada: item.cantidadPreparada,
    })
    .eq('id', item.id)
  return error ? msgSql(error.message) : null
}

export async function marcarTodoPreparado(client: SupabaseClient, ficha: PedidoFicha): Promise<string | null> {
  for (const item of ficha.items) {
    const fallo = await guardarItemPreparacion(client, {
      id: item.id,
      preparado: true,
      cantidadPreparada: item.cantidad,
    })
    if (fallo) return fallo
  }
  return null
}

export async function sincronizarEstadoPicking(
  client: SupabaseClient,
  ficha: PedidoFicha,
  items: PedidoItemFicha[],
): Promise<{ estado: EstadoPedido; error: string | null }> {
  if (
    ficha.estado === 'despachado' ||
    ficha.estado === 'con_transportista' ||
    ficha.estado === 'entregado' ||
    ficha.estado === 'cancelado'
  ) {
    return { estado: ficha.estado, error: null }
  }
  const todos = items.length > 0 && items.every(itemPickingCompleto)
  const alguno = items.some((i) => i.cantidadPreparada > 0 || i.preparado)
  let siguiente: EstadoPedido
  if (ficha.estado === 'listo_despacho') {
    siguiente = todos ? 'listo_despacho' : alguno ? 'en_preparacion' : 'nuevo'
  } else {
    siguiente = alguno ? 'en_preparacion' : 'nuevo'
  }
  if (siguiente === ficha.estado) return { estado: ficha.estado, error: null }
  const { error } = await client.from('pedidos').update({ estado: siguiente }).eq('id', ficha.id)
  if (error) return { estado: ficha.estado, error: msgSql(error.message) }
  return { estado: siguiente, error: null }
}

export async function confirmarListoDespacho(
  client: SupabaseClient,
  ficha: PedidoFicha,
  items: PedidoItemFicha[],
): Promise<string | null> {
  const faltan = textoIncompletosPicking(items)
  if (faltan) return faltan
  for (const item of items) {
    if (!item.preparado) {
      const fallo = await guardarItemPreparacion(client, {
        id: item.id,
        preparado: true,
        cantidadPreparada: item.cantidad,
      })
      if (fallo) return fallo
    }
  }
  const { error } = await client
    .from('pedidos')
    .update({ estado: 'listo_despacho' })
    .eq('id', ficha.id)
  return error ? msgSql(error.message) : null
}

export async function registrarDespacho(
  client: SupabaseClient,
  input: {
    ficha: PedidoFicha
    empresaId: string
    usuarioId: string
    transportista: string
    numeroSeguimiento: string
    ubicacionOrigen: string | null
  },
): Promise<string | null> {
  if (input.ficha.estado !== 'listo_despacho') {
    return 'El pedido tiene que estar listo para despacho'
  }
  const { error } = await client
    .from('pedidos')
    .update({
      estado: 'despachado',
      transportista: input.transportista.trim() || null,
      numero_seguimiento: input.numeroSeguimiento.trim() || null,
    })
    .eq('id', input.ficha.id)
    .eq('estado', 'listo_despacho')
  if (error) return msgSql(error.message)

  const filas = input.ficha.items
    .map((it) => {
      const cant = Math.max(1, Math.round(it.cantidad))
      return {
        empresa_id: input.empresaId,
        producto_id: it.productoId,
        usuario_id: input.usuarioId,
        tipo: 'pedido',
        cantidad: cant,
        signo: -1,
        precio_unitario: it.precioUnitario,
        motivo: `Pedido ${input.ficha.numeroPedido}`,
        referencia_id: input.ficha.id,
        variante_id: it.varianteId,
        lote_id: it.loteId,
        ubicacion_origen: input.ubicacionOrigen,
      }
    })
  const { error: movError } = await client.from('movimientos_inventario').insert(filas)
  if (movError) {
    const t = movError.message.toLowerCase()
    if (t.includes('tipo') || t.includes('check')) {
      const fallback = filas.map((f) => ({ ...f, tipo: 'venta' }))
      const retry = await client.from('movimientos_inventario').insert(fallback)
      if (retry.error) return msgSql(retry.error.message)
      return null
    }
    return msgSql(movError.message)
  }
  return null
}

export async function marcarConTransportista(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client
    .from('pedidos')
    .update({ estado: 'con_transportista' })
    .eq('id', id)
    .eq('estado', 'despachado')
  return error ? msgSql(error.message) : null
}

export async function marcarEntregado(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client
    .from('pedidos')
    .update({ estado: 'entregado' })
    .eq('id', id)
    .eq('estado', 'con_transportista')
  return error ? msgSql(error.message) : null
}

export async function generarRemitoPdf(input: {
  empresa: string
  ficha: PedidoFicha
  remitenteNombre: string
  remitenteDireccion: string
  remitenteTelefono: string
  remitenteEmail: string
}) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const { ficha, empresa } = input
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFillColor(99, 102, 241)
  doc.rect(40, 28, pageW - 80, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(`REMITO N° ${ficha.numeroPedido}`, 52, 54)
  doc.setFontSize(10)
  doc.text(`Fecha: ${formatoFechaRemito(ficha.createdAt)}`, 52, 74)
  doc.setFontSize(11)
  doc.text(empresa, pageW - 52, 54, { align: 'right' })

  const colW = (pageW - 80 - 12) / 2
  const boxY = 108
  const boxH = 92
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(40, boxY, colW, boxH, 4, 4, 'FD')
  doc.roundedRect(40 + colW + 12, boxY, colW, boxH, 4, 4, 'FD')

  doc.setFontSize(9)
  doc.setTextColor(99, 102, 241)
  doc.text('REMITENTE', 52, boxY + 16)
  doc.text('DESTINATARIO', 52 + colW + 12, boxY + 16)
  doc.setFontSize(9)
  doc.setTextColor(26, 47, 74)
  const remitenteLineas = doc.splitTextToSize(
    [
      input.remitenteNombre || empresa,
      input.remitenteDireccion,
      input.remitenteTelefono ? `Tel: ${input.remitenteTelefono}` : '',
      input.remitenteEmail,
    ]
      .filter(Boolean)
      .join('\n'),
    colW - 24,
  )
  const destLineas = doc.splitTextToSize(
    [
      ficha.clienteNombre || '—',
      ficha.direccionEnvio,
      [ficha.codigoPostal ? `(${ficha.codigoPostal})` : '', ficha.localidad].filter(Boolean).join(' '),
      ficha.provincia,
    ]
      .filter(Boolean)
      .join('\n'),
    colW - 24,
  )
  doc.text(remitenteLineas, 52, boxY + 32)
  doc.text(destLineas, 52 + colW + 12, boxY + 32)

  autoTable(doc, {
    startY: boxY + boxH + 20,
    head: [['#', 'Descripción', 'Cant', 'Precio']],
    body: ficha.items.map((it, i) => {
      const desc = [it.nombre, it.varianteEtiqueta, it.numeroLote ? `Lote ${it.numeroLote}` : '']
        .filter(Boolean)
        .join('\n')
      return [String(i + 1), desc, String(it.cantidad), formatoARS(it.precioUnitario)]
    }),
    styles: { fontSize: 9, cellPadding: 6, textColor: [26, 47, 74] },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28 },
      2: { cellWidth: 48, halign: 'right' },
      3: { cellWidth: 80, halign: 'right' },
    },
    margin: { left: 40, right: 40 },
  })

  const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 240
  const link = urlSeguimiento(ficha.transportista || ficha.metodoEnvio, ficha.numeroSeguimiento)
  doc.setFontSize(12)
  doc.setTextColor(26, 47, 74)
  doc.text(`Total: ${formatoARS(ficha.total)}`, 40, y + 28)
  doc.setFontSize(10)
  doc.setTextColor(74, 85, 104)
  doc.text(`Método de envío: ${ficha.metodoEnvio || ficha.transportista || '—'}`, 40, y + 48)
  if (ficha.numeroSeguimiento) {
    doc.text(`N° seguimiento: ${ficha.numeroSeguimiento}`, 40, y + 64)
  }
  if (link) {
    doc.setTextColor(99, 102, 241)
    doc.textWithLink(`Link seguimiento: ${link}`, 40, y + 80, { url: link })
  }
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Este documento no tiene validez fiscal', 40, y + 108)
  doc.text('Analítica 360 — analitica360.app', 40, y + 122)

  doc.save(`remito_${ficha.numeroPedido || 'pedido'}.pdf`)
}
