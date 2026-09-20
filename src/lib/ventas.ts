import type { SupabaseClient } from '@supabase/supabase-js'
import { formatoFechaHora } from './fechas'

export type EstadoCobro = 'pagado' | 'señado' | 'saldo_pendiente'

export type VentaFila = {
  id: string
  numeroVenta: string | null
  fecha: string
  productos: string
  total: number
  forma_pago: string
  cliente: string | null
  cuotas: number
  productoIds: string[]
  descuento: number
  notas: string | null
  anulada: boolean
  esSenia: boolean
  montoSenia: number
  saldoPendiente: number
  estadoCobro: EstadoCobro
  fechaCobroSaldo: string | null
}

export type VentaFicha = VentaFila & {
  items: { nombre: string; cantidad: number; precioUnitario: number }[]
}

export type FiltrosVentas = {
  desde: string
  hasta: string
  forma: string
  cliente: string
  productoId: string
  numeroVenta: string
  mostrarAnuladas: boolean
}

export type ResumenVentasHoy = {
  cantidad: number
  total: number
}

export const FORMAS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'qr', label: 'Mercado Pago QR' },
] as const

export function etiquetaFormaPago(id: string) {
  return FORMAS_PAGO.find((f) => f.id === id)?.label ?? id
}

export function etiquetaCuotas(n: number) {
  if (n <= 1) return 'Contado'
  return `${n} cuotas`
}

function aplicarDeleted<T extends { is: (c: string, v: null) => T; not: (c: string, op: string, v: null) => T }>(
  q: T,
  mostrarAnuladas: boolean,
) {
  return mostrarAnuladas ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null)
}

async function hidratarVentas(
  client: SupabaseClient,
  ids: string[],
): Promise<{ filas: VentaFila[]; error: string | null }> {
  if (ids.length === 0) return { filas: [], error: null }

  let ventasRes = await client
    .from('ventas')
    .select(
      'id, numero_venta, fecha, forma_pago, cliente_nombre, cuotas, descuento, total_sin_interes, total_con_interes, notas, deleted_at, es_senia, monto_senia, saldo_pendiente, estado_cobro, fecha_cobro_saldo',
    )
    .in('id', ids)
  if (ventasRes.error) {
    const t = ventasRes.error.message.toLowerCase()
    if (t.includes('es_senia') || t.includes('schema cache') || t.includes('does not exist')) {
      ventasRes = (await client
        .from('ventas')
        .select('id, numero_venta, fecha, forma_pago, cliente_nombre, cuotas, descuento, total_sin_interes, total_con_interes, notas, deleted_at')
        .in('id', ids)) as typeof ventasRes
    }
  }
  if (ventasRes.error) return { filas: [], error: ventasRes.error.message }

  const itemsRes = await client
    .from('ventas_items')
    .select('venta_id, producto_id, cantidad, precio_unitario, productos(nombre)')
    .in('venta_id', ids)

  const itemsPorVenta = new Map<string, { nombres: string[]; ids: string[]; total: number }>()
  for (const row of (itemsRes.data ?? []) as Record<string, unknown>[]) {
    const vid = String(row.venta_id)
    const pid = String(row.producto_id)
    const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
    const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
    const cant = Number(row.cantidad ?? 0)
    const precio = Number(row.precio_unitario ?? 0)
    const acc = itemsPorVenta.get(vid) ?? { nombres: [], ids: [], total: 0 }
    acc.nombres.push(`${nombre ?? 'Producto'} × ${cant}`)
    acc.ids.push(pid)
    acc.total += precio * cant
    itemsPorVenta.set(vid, acc)
  }

  const porId = new Map((ventasRes.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]))
  const filas: VentaFila[] = ids.map((id) => {
    const row = porId.get(id) ?? {}
    const items = itemsPorVenta.get(id)
    const descuento = Number(row.descuento ?? 0)
    const totalCon = Number(row.total_con_interes ?? 0)
    const totalSin = Number(row.total_sin_interes ?? 0)
    const totalCalc = (items?.total ?? 0) - descuento
    return {
      id,
      numeroVenta: row.numero_venta == null || row.numero_venta === '' ? null : String(row.numero_venta),
      fecha: String(row.fecha ?? ''),
      productos: items?.nombres.join(', ') ?? '',
      total: totalCon > 0 ? totalCon : totalSin > 0 ? totalSin : totalCalc,
      forma_pago: String(row.forma_pago ?? ''),
      cliente: row.cliente_nombre == null || row.cliente_nombre === '' ? null : String(row.cliente_nombre),
      cuotas: Number(row.cuotas ?? 1),
      productoIds: items?.ids ?? [],
      descuento,
      notas: row.notas == null || row.notas === '' ? null : String(row.notas),
      anulada: row.deleted_at != null,
      esSenia: Boolean(row.es_senia),
      montoSenia: Number(row.monto_senia ?? 0),
      saldoPendiente: Number(row.saldo_pendiente ?? 0),
      estadoCobro: (['pagado', 'señado', 'saldo_pendiente'].includes(String(row.estado_cobro ?? ''))
        ? row.estado_cobro
        : 'pagado') as EstadoCobro,
      fechaCobroSaldo: row.fecha_cobro_saldo ? String(row.fecha_cobro_saldo) : null,
    }
  })
  return { filas, error: null }
}

export async function rangoHistorialVentas(
  client: SupabaseClient,
): Promise<{ desde: string; hasta: string } | null> {
  const { data, error } = await client
    .from('ventas')
    .select('fecha')
    .is('deleted_at', null)
    .order('fecha', { ascending: true })
    .limit(1)
  if (error || !data?.[0]?.fecha) return null
  const maxRes = await client
    .from('ventas')
    .select('fecha')
    .is('deleted_at', null)
    .order('fecha', { ascending: false })
    .limit(1)
  const desde = String(data[0].fecha).slice(0, 10)
  const hasta = String(maxRes.data?.[0]?.fecha ?? data[0].fecha).slice(0, 10)
  if (!desde || !hasta) return null
  return { desde, hasta }
}

export async function listarVentasPaginado(
  client: SupabaseClient,
  input: FiltrosVentas & { pagina: number; pageSize: number },
): Promise<{ filas: VentaFila[]; total: number; error: string | null }> {
  const from = (input.pagina - 1) * input.pageSize
  const to = from + input.pageSize - 1

  const filtrosFecha = {
    desde: `${input.desde}T00:00:00.000-03:00`,
    hasta: `${input.hasta}T23:59:59.999-03:00`,
  }
  const clienteQ = input.cliente.trim()
  const numeroQ = input.numeroVenta.trim()
  const porNumero = numeroQ.length > 0

  const idsRes = input.productoId
    ? await (() => {
        let q = client
          .from('ventas')
          .select('id, ventas_items!inner(producto_id)', { count: 'exact' })
          .order('fecha', { ascending: false })
          .eq('ventas_items.producto_id', input.productoId)
        if (!porNumero) {
          q = q.gte('fecha', filtrosFecha.desde).lte('fecha', filtrosFecha.hasta)
        }
        q = aplicarDeleted(q, input.mostrarAnuladas)
        if (input.forma) q = q.eq('forma_pago', input.forma)
        if (clienteQ) q = q.ilike('cliente_nombre', `%${clienteQ}%`)
        if (porNumero) q = q.ilike('numero_venta', `%${numeroQ}%`)
        return q.range(from, to)
      })()
    : await (() => {
        let q = client
          .from('ventas')
          .select('id', { count: 'exact' })
          .order('fecha', { ascending: false })
        if (!porNumero) {
          q = q.gte('fecha', filtrosFecha.desde).lte('fecha', filtrosFecha.hasta)
        }
        q = aplicarDeleted(q, input.mostrarAnuladas)
        if (input.forma) q = q.eq('forma_pago', input.forma)
        if (clienteQ) q = q.ilike('cliente_nombre', `%${clienteQ}%`)
        if (porNumero) q = q.ilike('numero_venta', `%${numeroQ}%`)
        return q.range(from, to)
      })()

  if (idsRes.error) {
    const t = idsRes.error.message.toLowerCase()
    if (t.includes('numero_venta') || t.includes('schema cache') || t.includes('does not exist')) {
      return {
        filas: [],
        total: 0,
        error:
          'Falta el N° de venta. Pegá TODO supabase/037_numero_venta_anular_compras_categorias.sql (rol postgres), dale Run y recargá.',
      }
    }
    return { filas: [], total: 0, error: idsRes.error.message }
  }

  const total = idsRes.count ?? 0
  const ids = [...new Set((idsRes.data ?? []).map((row) => String(row.id)))]
  const hidratado = await hidratarVentas(client, ids)
  if (hidratado.error) return { filas: [], total: 0, error: hidratado.error }
  return { filas: hidratado.filas, total, error: null }
}

export async function listarVentasExport(
  client: SupabaseClient,
  input: FiltrosVentas,
): Promise<{ filas: VentaFila[]; error: string | null }> {
  const pageSize = 200
  const todas: VentaFila[] = []
  let pagina = 1
  for (;;) {
    const { filas, total, error } = await listarVentasPaginado(client, {
      ...input,
      pagina,
      pageSize,
    })
    if (error) return { filas: [], error }
    if (total > 50000) {
      return {
        filas: [],
        error: `Hay ${total} ventas en este período.\nAplicá un filtro de fecha más acotado para exportar.`,
      }
    }
    todas.push(...filas)
    if (todas.length >= total || filas.length === 0) break
    pagina += 1
    if (pagina > 250) break
  }
  return { filas: todas, error: null }
}

export async function resumenVentasHoy(
  client: SupabaseClient,
): Promise<ResumenVentasHoy> {
  const { data, error } = await client.rpc('resumen_ventas_hoy')
  if (error) return { cantidad: 0, total: 0 }
  const fila = Array.isArray(data) ? data[0] : data
  return {
    cantidad: Number(fila?.cantidad ?? 0),
    total: Number(fila?.total ?? 0),
  }
}

export const OPCIONES_CUOTAS = [
  { id: '1', cuotas: 1, label: '1 cuota (contado)', coefDefault: 0 },
  { id: '3', cuotas: 3, label: '3 cuotas', coefDefault: 0 },
  { id: '6', cuotas: 6, label: '6 cuotas', coefDefault: 15 },
  { id: '9', cuotas: 9, label: '9 cuotas', coefDefault: 25 },
  { id: '12', cuotas: 12, label: '12 cuotas', coefDefault: 45 },
  { id: '18', cuotas: 18, label: '18 cuotas', coefDefault: 70 },
  { id: '24', cuotas: 24, label: '24 cuotas', coefDefault: 95 },
  { id: 'z', cuotas: 0, label: 'Plan Z', coefDefault: null },
] as const

export type OpcionCuotaId = (typeof OPCIONES_CUOTAS)[number]['id']

export function calcularTotalesCredito(totalSinInteres: number, coeficiente: number, cuotas: number) {
  const coef = Math.max(0, Number.isFinite(coeficiente) ? coeficiente : 0)
  const interes = Number((totalSinInteres * (coef / 100)).toFixed(2))
  const totalConInteres = Number((totalSinInteres + interes).toFixed(2))
  const valorCuota = cuotas > 0 ? Number((totalConInteres / cuotas).toFixed(2)) : totalConInteres
  return { interes, totalConInteres, valorCuota }
}

export async function confirmarVenta(
  client: SupabaseClient,
  input: {
    items: {
      producto_id: string
      cantidad: number
      precio_unitario: number
      variante_id?: string | null
      lote_id?: string | null
    }[]
    formaPago: string
    descuento: number
    cliente: string
    clienteId?: string | null
    cuotas?: number
    coeficienteInteres?: number
    totalSinInteres?: number
    totalConInteres?: number
    ubicacionOrigen?: string | null
    esSenia?: boolean
    montoSenia?: number
  },
): Promise<string | null> {
  const args: Record<string, unknown> = {
    p_items: input.items,
    p_forma_pago: input.formaPago,
    p_descuento: input.descuento,
    p_cliente: input.cliente,
    p_cliente_id: input.clienteId ?? null,
    p_cuotas: input.cuotas ?? 1,
    p_coeficiente_interes: input.coeficienteInteres ?? 0,
    p_total_sin_interes: input.totalSinInteres ?? null,
    p_total_con_interes: input.totalConInteres ?? null,
  }
  if (input.ubicacionOrigen) args.p_ubicacion_origen = input.ubicacionOrigen
  let { data, error } = await client.rpc('confirmar_venta', args)
  if (error && args.p_ubicacion_origen) {
    const t = error.message.toLowerCase()
    if (t.includes('p_ubicacion_origen') || t.includes('schema cache') || t.includes('could not find')) {
      delete args.p_ubicacion_origen
      const retry = await client.rpc('confirmar_venta', args)
      data = retry.data
      error = retry.error
    }
  }
  if (!error) {
    if (input.esSenia && input.montoSenia && data) {
      const senia = await client.rpc('marcar_senia_venta', { p_id: data, p_monto: input.montoSenia })
      if (senia.error) {
        const t = senia.error.message.toLowerCase()
        if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
          return 'Falta crear señas. Pegá TODO supabase/068_senias.sql (rol postgres), dale Run y recargá.'
        }
        if (senia.error.message.includes('SENIA_INVALIDA')) {
          return 'La seña tiene que ser mayor a 0 y menor que el total'
        }
        return senia.error.message
      }
    }
    return null
  }
  const msg = error.message
  if (msg.includes('Producto no pertenece a esta empresa')) {
    return 'Producto no pertenece a esta empresa'
  }
  if (msg.includes('UBICACION_INVALIDA')) return 'Esa ubicación no está disponible'
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta actualizar confirmar_venta en Supabase. Pegá TODO supabase/038_perf_seguridad_productos_ventas.sql, supabase/046_lotes.sql y supabase/047_ubicaciones.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export async function anularVenta(
  client: SupabaseClient,
  id: string,
  motivo: string,
): Promise<string | null> {
  const { error } = await client.rpc('anular_venta', { p_id: id, p_motivo: motivo })
  if (!error) return null
  const msg = error.message
  if (msg.includes('NO_AUTORIZADO')) return 'Solo el dueño puede anular ventas'
  if (msg.includes('MOTIVO_OBLIGATORIO')) return 'El motivo de anulación es obligatorio'
  if (msg.includes('VENTA_INVALIDA')) return 'Esa venta ya no se puede anular'
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta actualizar la anulación en Supabase. Pegá TODO supabase/063_fix_anulacion_stock.sql (rol postgres), dale Run y recargá.'
  }
  return `No se pudo anular la venta: ${msg}`
}

export function formatoFechaVenta(iso: string) {
  return formatoFechaHora(iso)
}

export function etiquetaEstadoCobro(estado: string, esSenia: boolean) {
  if (!esSenia) return null
  if (estado === 'pagado') return { texto: 'Saldo cobrado', fg: '#4ADE80', bg: 'rgba(74,222,128,0.16)' }
  return { texto: 'Señado', fg: '#F59E0B', bg: 'rgba(245,158,11,0.18)' }
}

export async function obtenerVenta(
  client: SupabaseClient,
  id: string,
): Promise<{ data: VentaFicha | null; error: string | null }> {
  const { filas, error } = await hidratarVentas(client, [id])
  if (error) return { data: null, error }
  const base = filas[0]
  if (!base) return { data: null, error: 'No se encontró la venta' }
  const itemsRes = await client
    .from('ventas_items')
    .select('cantidad, precio_unitario, productos(nombre)')
    .eq('venta_id', id)
  return {
    data: {
      ...base,
      items: ((itemsRes.data ?? []) as Record<string, unknown>[]).map((row) => {
        const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
        const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
        return {
          nombre: String(nombre ?? 'Producto'),
          cantidad: Number(row.cantidad ?? 0),
          precioUnitario: Number(row.precio_unitario ?? 0),
        }
      }),
    },
    error: null,
  }
}

export async function cobrarSaldoVenta(
  client: SupabaseClient,
  input: { id: string; monto: number; formaPago: string; fecha: string },
): Promise<string | null> {
  const { error } = await client.rpc('cobrar_saldo_venta', {
    p_id: input.id,
    p_monto: input.monto,
    p_forma_pago: input.formaPago,
    p_fecha: `${input.fecha}T12:00:00.000-03:00`,
  })
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta crear señas. Pegá TODO supabase/068_senias.sql (rol postgres), dale Run y recargá.'
  }
  if (error.message.includes('VENTA_INVALIDA')) return 'Esa venta no tiene saldo para cobrar'
  if (error.message.includes('MONTO_INVALIDO')) return 'El monto tiene que ser mayor a 0'
  return error.message
}
