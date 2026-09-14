import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmarCompra, hoyCompraISO } from './compras'
import { formatoARS } from './productos'

export const ESTADOS_OC = [
  'borrador',
  'enviada',
  'confirmada',
  'recibida_parcial',
  'recibida',
  'cancelada',
] as const

export type EstadoOc = (typeof ESTADOS_OC)[number]

export type OrdenCompraItem = {
  id: string
  productoId: string
  varianteId: string | null
  nombre: string
  varianteEtiqueta: string | null
  cantidadPedida: number
  precioUnitario: number
  cantidadRecibida: number
  recibido: boolean
}

export type OrdenCompraFila = {
  id: string
  numeroOc: string
  proveedorId: string | null
  proveedorNombre: string | null
  estado: EstadoOc
  fechaEmision: string
  fechaEntregaEstimada: string | null
  notas: string | null
  total: number
}

export type OrdenCompraFicha = OrdenCompraFila & {
  items: OrdenCompraItem[]
  proveedorContacto: string | null
  proveedorCuit: string | null
}

export type ItemOcInput = {
  productoId: string
  varianteId: string | null
  cantidadPedida: number
  precioUnitario: number
}

const MSG_SQL =
  'Falta el módulo de órdenes de compra. Pegá TODO supabase/059_ordenes_compra.sql (rol postgres), dale Run y recargá.'

export const BADGE_ESTADO_OC: Record<EstadoOc, { bg: string; fg: string; label: string }> = {
  borrador: { bg: 'rgba(148,163,184,0.18)', fg: '#94A3B8', label: 'Borrador' },
  enviada: { bg: 'rgba(59,130,246,0.18)', fg: '#3B82F6', label: 'Enviada' },
  confirmada: { bg: 'rgba(99,102,241,0.18)', fg: '#6366F1', label: 'Confirmada' },
  recibida_parcial: { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B', label: 'Recibida parcial' },
  recibida: { bg: 'rgba(74,222,128,0.18)', fg: '#4ADE80', label: 'Recibida' },
  cancelada: { bg: 'rgba(248,113,113,0.18)', fg: '#F87171', label: 'Cancelada' },
}

function msgSql(msg: string) {
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('does not exist') || t.includes('ordenes_compra')) {
    return MSG_SQL
  }
  return msg
}

function esEstado(v: string): EstadoOc {
  return (ESTADOS_OC as readonly string[]).includes(v) ? (v as EstadoOc) : 'borrador'
}

function txt(v: unknown) {
  if (v == null || v === '') return null
  return String(v)
}

function mapFila(row: Record<string, unknown>): OrdenCompraFila {
  const prov = row.proveedores as Record<string, unknown> | null
  return {
    id: String(row.id),
    numeroOc: String(row.numero_oc ?? ''),
    proveedorId: txt(row.proveedor_id),
    proveedorNombre: prov ? String(prov.nombre ?? prov.nombre_comercial ?? '') || null : null,
    estado: esEstado(String(row.estado ?? 'borrador')),
    fechaEmision: String(row.fecha_emision ?? '').slice(0, 10),
    fechaEntregaEstimada: txt(row.fecha_entrega_estimada)?.slice(0, 10) ?? null,
    notas: txt(row.notas),
    total: Number(row.total ?? 0),
  }
}

export async function listarOrdenesCompra(
  client: SupabaseClient,
  input: { estado: string; proveedorId: string },
): Promise<{ filas: OrdenCompraFila[]; error: string | null }> {
  let q = client
    .from('ordenes_compra')
    .select('id, numero_oc, proveedor_id, estado, fecha_emision, fecha_entrega_estimada, notas, total, proveedores(nombre, nombre_comercial)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (input.estado && input.estado !== 'todos') q = q.eq('estado', input.estado)
  if (input.proveedorId) q = q.eq('proveedor_id', input.proveedorId)
  const { data, error } = await q
  if (error) return { filas: [], error: msgSql(error.message) }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapFila), error: null }
}

export async function obtenerOrdenCompra(
  client: SupabaseClient,
  id: string,
): Promise<{ ficha: OrdenCompraFicha | null; error: string | null }> {
  const cab = await client
    .from('ordenes_compra')
    .select(
      'id, numero_oc, proveedor_id, estado, fecha_emision, fecha_entrega_estimada, notas, total, proveedores(nombre, nombre_comercial, telefono, email, cuit, nombre_vendedor)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (cab.error) return { ficha: null, error: msgSql(cab.error.message) }
  if (!cab.data) return { ficha: null, error: 'No se encontró la orden de compra' }
  const itemsRes = await client
    .from('ordenes_compra_items')
    .select('id, producto_id, variante_id, cantidad_pedida, precio_unitario, cantidad_recibida, recibido, productos(nombre), producto_variantes(atributos)')
    .eq('orden_compra_id', id)
  if (itemsRes.error) {
    const t = itemsRes.error.message.toLowerCase()
    if (t.includes('producto_variantes')) {
      const retry = await client
        .from('ordenes_compra_items')
        .select('id, producto_id, variante_id, cantidad_pedida, precio_unitario, cantidad_recibida, recibido, productos(nombre)')
        .eq('orden_compra_id', id)
      if (retry.error) return { ficha: null, error: msgSql(retry.error.message) }
      return { ficha: armarFicha(cab.data as Record<string, unknown>, retry.data ?? []), error: null }
    }
    return { ficha: null, error: msgSql(itemsRes.error.message) }
  }
  return { ficha: armarFicha(cab.data as Record<string, unknown>, itemsRes.data ?? []), error: null }
}

function etiquetaAtributos(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const parts = Object.values(raw as Record<string, unknown>)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
  return parts.length ? parts.join('/') : null
}

function armarFicha(row: Record<string, unknown>, itemsRaw: unknown[]): OrdenCompraFicha {
  const base = mapFila(row)
  const prov = row.proveedores as Record<string, unknown> | null
  const contacto = prov
    ? [txt(prov.nombre_vendedor), txt(prov.telefono), txt(prov.email)].filter(Boolean).join(' · ') || null
    : null
  return {
    ...base,
    proveedorNombre: base.proveedorNombre || (prov ? String(prov.nombre ?? '') : null),
    proveedorContacto: contacto,
    proveedorCuit: txt(prov?.cuit),
    items: itemsRaw.map((raw) => {
      const it = raw as Record<string, unknown>
      const prod = it.productos as Record<string, unknown> | null
      const vari = it.producto_variantes as Record<string, unknown> | null
      return {
        id: String(it.id),
        productoId: String(it.producto_id),
        varianteId: txt(it.variante_id),
        nombre: String(prod?.nombre ?? 'Producto'),
        varianteEtiqueta: etiquetaAtributos(vari?.atributos),
        cantidadPedida: Number(it.cantidad_pedida ?? 0),
        precioUnitario: Number(it.precio_unitario ?? 0),
        cantidadRecibida: Number(it.cantidad_recibida ?? 0),
        recibido: Boolean(it.recibido),
      }
    }),
  }
}

export async function guardarOrdenCompra(
  client: SupabaseClient,
  input: {
    id?: string
    empresaId: string
    proveedorId: string | null
    fechaEntregaEstimada: string | null
    notas: string
    estado: 'borrador' | 'enviada'
    items: ItemOcInput[]
  },
): Promise<{ id: string | null; error: string | null }> {
  const total = input.items.reduce((acc, it) => acc + it.cantidadPedida * it.precioUnitario, 0)
  const payload = {
    empresa_id: input.empresaId,
    proveedor_id: input.proveedorId,
    fecha_entrega_estimada: input.fechaEntregaEstimada || null,
    notas: input.notas.trim() || null,
    estado: input.estado,
    total,
    numero_oc: input.id ? undefined : '',
  }
  let id = input.id ?? null
  if (id) {
    const { error } = await client
      .from('ordenes_compra')
      .update({
        proveedor_id: payload.proveedor_id,
        fecha_entrega_estimada: payload.fecha_entrega_estimada,
        notas: payload.notas,
        estado: payload.estado,
        total: payload.total,
      })
      .eq('id', id)
    if (error) return { id: null, error: msgSql(error.message) }
    const del = await client.from('ordenes_compra_items').delete().eq('orden_compra_id', id)
    if (del.error) return { id: null, error: msgSql(del.error.message) }
  } else {
    const ins = await client
      .from('ordenes_compra')
      .insert({
        empresa_id: payload.empresa_id,
        proveedor_id: payload.proveedor_id,
        fecha_entrega_estimada: payload.fecha_entrega_estimada,
        notas: payload.notas,
        estado: payload.estado,
        total: payload.total,
      })
      .select('id')
      .single()
    if (ins.error || !ins.data) return { id: null, error: msgSql(ins.error?.message ?? 'No se pudo crear la OC') }
    id = String(ins.data.id)
  }
  const filas = input.items.map((it) => ({
    orden_compra_id: id,
    producto_id: it.productoId,
    variante_id: it.varianteId,
    cantidad_pedida: it.cantidadPedida,
    precio_unitario: it.precioUnitario,
    cantidad_recibida: 0,
    recibido: false,
  }))
  const itemsIns = await client.from('ordenes_compra_items').insert(filas)
  if (itemsIns.error) return { id: null, error: msgSql(itemsIns.error.message) }
  return { id, error: null }
}

export async function actualizarEstadoOc(
  client: SupabaseClient,
  id: string,
  estado: EstadoOc,
): Promise<string | null> {
  const { error } = await client.from('ordenes_compra').update({ estado }).eq('id', id)
  return error ? msgSql(error.message) : null
}

export async function registrarRecepcionOc(
  client: SupabaseClient,
  input: {
    ficha: OrdenCompraFicha
    cantidades: Record<string, number>
    proveedorNombre: string
  },
): Promise<string | null> {
  const lote: { item: OrdenCompraItem; qty: number }[] = []
  for (const item of input.ficha.items) {
    const qty = Math.max(0, Number(input.cantidades[item.id] ?? 0))
    if (!Number.isFinite(qty) || qty <= 0) continue
    const pendiente = Math.max(0, item.cantidadPedida - item.cantidadRecibida)
    lote.push({ item, qty: Math.min(qty, pendiente) })
  }
  if (lote.length === 0) return 'Indicá al menos una cantidad recibida'

  const compraError = await confirmarCompra(client, {
    items: lote.map(({ item, qty }) => ({
      producto_id: item.productoId,
      producto_nombre: item.varianteEtiqueta ? `${item.nombre} (${item.varianteEtiqueta})` : item.nombre,
      cantidad: qty,
      costo_unitario: item.precioUnitario,
      variante_id: item.varianteId,
    })),
    proveedor: input.proveedorNombre,
    proveedorId: input.ficha.proveedorId,
    fecha: hoyCompraISO(),
    notas: `Generada desde ${input.ficha.numeroOc}`,
  })
  if (compraError) return compraError

  for (const { item, qty } of lote) {
    const nueva = item.cantidadRecibida + qty
    const { error } = await client
      .from('ordenes_compra_items')
      .update({
        cantidad_recibida: nueva,
        recibido: nueva >= item.cantidadPedida,
      })
      .eq('id', item.id)
    if (error) return msgSql(error.message)
  }

  const last = await client
    .from('compras')
    .select('id')
    .is('deleted_at', null)
    .ilike('notas', `%${input.ficha.numeroOc}%`)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last.data?.id) {
    await client.from('compras').update({ orden_compra_id: input.ficha.id }).eq('id', last.data.id)
  }

  const items = input.ficha.items.map((it) => {
    const extra = lote.find((l) => l.item.id === it.id)?.qty ?? 0
    return { ...it, cantidadRecibida: it.cantidadRecibida + extra }
  })
  const completa = items.length > 0 && items.every((it) => it.cantidadRecibida >= it.cantidadPedida)
  const alguna = items.some((it) => it.cantidadRecibida > 0)
  const estado: EstadoOc = completa ? 'recibida' : alguna ? 'recibida_parcial' : input.ficha.estado
  return actualizarEstadoOc(client, input.ficha.id, estado)
}

export function notasDesdeOc(notas: string | null) {
  const raw = String(notas ?? '')
  const m = raw.match(/Generada desde (OC-\d+)/i)
  return m ? m[1] : null
}

export async function generarOcPdf(input: {
  empresa: string
  direccion: string
  ficha: OrdenCompraFicha
}) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const { ficha } = input

  doc.setFillColor(15, 27, 45)
  doc.rect(40, 28, pageW - 80, 78, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.text(input.empresa || 'Empresa', 52, 50)
  if (input.direccion) {
    doc.setFontSize(9)
    doc.text(input.direccion, 52, 66)
  }
  doc.setFontSize(16)
  doc.text('ORDEN DE COMPRA', pageW - 52, 50, { align: 'right' })
  doc.setFontSize(10)
  doc.text(`N° ${ficha.numeroOc}`, pageW - 52, 68, { align: 'right' })
  doc.text(`Fecha: ${formatoFechaOc(ficha.fechaEmision)}`, pageW - 52, 84, { align: 'right' })
  if (ficha.fechaEntregaEstimada) {
    doc.text(`Entrega: ${formatoFechaOc(ficha.fechaEntregaEstimada)}`, pageW - 52, 98, { align: 'right' })
  }

  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(40, 122, 240, 88, 4, 4, 'FD')
  doc.setFontSize(9)
  doc.setTextColor(99, 102, 241)
  doc.text('PROVEEDOR', 52, 140)
  doc.setTextColor(26, 47, 74)
  doc.setFontSize(10)
  const provLineas = doc.splitTextToSize(
    [ficha.proveedorNombre || '—', ficha.proveedorContacto, ficha.proveedorCuit ? `CUIT ${ficha.proveedorCuit}` : '']
      .filter(Boolean)
      .join('\n'),
    216,
  )
  doc.text(provLineas, 52, 158)

  autoTable(doc, {
    startY: 228,
    head: [['N°', 'Producto', 'Variante', 'Cant', 'Precio unit', 'Subtotal']],
    body: ficha.items.map((it, i) => [
      String(i + 1),
      it.nombre,
      it.varianteEtiqueta || '—',
      String(it.cantidadPedida),
      formatoARS(it.precioUnitario),
      formatoARS(it.cantidadPedida * it.precioUnitario),
    ]),
    styles: { fontSize: 9, cellPadding: 6, textColor: [26, 47, 74] },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28 },
      3: { cellWidth: 48, halign: 'right' },
      4: { cellWidth: 80, halign: 'right' },
      5: { cellWidth: 80, halign: 'right' },
    },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 400
  doc.setFontSize(12)
  doc.setTextColor(26, 47, 74)
  doc.text(`Total: ${formatoARS(ficha.total)}`, pageW - 52, finalY + 28, { align: 'right' })
  if (ficha.notas) {
    doc.setFontSize(9)
    doc.setTextColor(74, 85, 104)
    const notas = doc.splitTextToSize(`Notas: ${ficha.notas}`, pageW - 92)
    doc.text(notas, 40, finalY + 52)
  }
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Documento interno — no tiene validez fiscal', 40, doc.internal.pageSize.getHeight() - 36)

  doc.save(`${ficha.numeroOc}.pdf`)
}

export function formatoFechaOc(iso: string | null) {
  if (!iso) return '—'
  const raw = String(iso).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
