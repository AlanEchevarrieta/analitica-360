import type { SupabaseClient } from '@supabase/supabase-js'

export type UbicacionFila = {
  id: string
  nombre: string
  descripcion: string | null
}

export type ResumenInventario = {
  id: string
  nombre: string
  categoria: string | null
  stock_actual: number
  ultima_entrada: string | null
  ultima_salida: string | null
  rotacion_30: number
  stock_casa: number
  stock_stand: number
}

export type EstadoStock = 'sin' | 'bajo' | 'normal'

export function estadoStock(stock: number, umbral: number): EstadoStock {
  if (stock <= 0) return 'sin'
  if (stock <= umbral) return 'bajo'
  return 'normal'
}

export function etiquetaEstadoStock(estado: EstadoStock) {
  if (estado === 'sin') return { icono: '🔴', texto: 'Sin stock' }
  if (estado === 'bajo') return { icono: '🟡', texto: 'Stock bajo' }
  return { icono: '🟢', texto: 'Normal' }
}

export type MovimientoKardex = {
  id: string
  tipo: string
  cantidad: number
  signo: number
  motivo: string | null
  fecha: string
  referenciaId: string | null
  usuarioNombre: string
  saldo: number
  ubicacionOrigen: string | null
  ubicacionDestino: string | null
  ventaFecha: string | null
}

export function estiloTipoMovimiento(tipo: string, signo: number) {
  const t = tipo.toLowerCase()
  const positivo =
    t === 'compra' ||
    t === 'devolucion_cliente' ||
    t === 'devolucion' ||
    t === 'ajuste_positivo' ||
    signo === 1
  if (t === 'compra') return { icono: '🛒', texto: 'Compra', clase: 'text-[#4ADE80]' }
  if (t === 'venta') return { icono: '💸', texto: 'Venta', clase: 'text-[#F87171]' }
  if (t === 'devolucion_cliente' || t === 'devolucion') {
    return { icono: '↩️', texto: 'Devolución', clase: 'text-[#4ADE80]' }
  }
  if (t === 'ajuste_positivo') return { icono: '📦', texto: 'Ajuste +', clase: 'text-[#4ADE80]' }
  if (t === 'consumo_interno') return { icono: '🎁', texto: 'Consumo interno', clase: 'text-[#F87171]' }
  if (t === 'transferencia') {
    return {
      icono: '🔁',
      texto: signo === 1 ? 'Traslado (entra)' : 'Traslado (sale)',
      clase: positivo ? 'text-[#4ADE80]' : 'text-[#F87171]',
    }
  }
  if (t === 'ajuste_negativo' || t === 'merma' || t === 'rotura' || t === 'perdida') {
    const label = t === 'ajuste_negativo' ? 'Ajuste −' : t.charAt(0).toUpperCase() + t.slice(1)
    return { icono: '⚠️', texto: label, clase: 'text-[#F87171]' }
  }
  return {
    icono: '•',
    texto: tipo,
    clase: positivo ? 'text-[#4ADE80]' : 'text-[#F87171]',
  }
}

export function formatoFechaMov(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export async function listarUbicaciones(
  client: SupabaseClient,
): Promise<{ filas: UbicacionFila[]; error: string | null }> {
  const { data, error } = await client
    .from('ubicaciones')
    .select('id, nombre, descripcion')
    .eq('activo', true)
    .order('nombre')
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('ubicaciones') || t.includes('schema cache') || t.includes('does not exist')) {
      return { filas: [], error: null }
    }
    return { filas: [], error: error.message }
  }
  return {
    filas: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre),
      descripcion: row.descripcion == null ? null : String(row.descripcion),
    })),
    error: null,
  }
}

export async function leerUmbralStock(client: SupabaseClient, empresaId: string) {
  const { data } = await client
    .from('configuracion_empresa')
    .select('inventario')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  const inv = data?.inventario as Record<string, unknown> | null
  const n = Number(inv?.umbral_stock_bajo)
  return Number.isFinite(n) && n >= 0 ? n : 5
}

function filaResumen(row: Record<string, unknown>): ResumenInventario {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    categoria: row.categoria == null ? null : String(row.categoria),
    stock_actual: Number(row.stock_actual ?? 0),
    ultima_entrada: row.ultima_entrada == null ? null : String(row.ultima_entrada),
    ultima_salida: row.ultima_salida == null ? null : String(row.ultima_salida),
    rotacion_30: Number(row.rotacion_30 ?? 0),
    stock_casa: Number(row.stock_casa ?? 0),
    stock_stand: Number(row.stock_stand ?? 0),
  }
}

export async function listarResumenInventario(
  client: SupabaseClient,
): Promise<{ filas: ResumenInventario[]; error: string | null }> {
  const rpc = await client.rpc('listar_resumen_inventario')
  if (!rpc.error) {
    return {
      filas: ((rpc.data ?? []) as Record<string, unknown>[]).map(filaResumen),
      error: null,
    }
  }
  const t = rpc.error.message.toLowerCase()
  if (!t.includes('listar_resumen') && !t.includes('schema cache') && !t.includes('does not exist')) {
    return { filas: [], error: rpc.error.message }
  }

  const prods = await client
    .from('productos')
    .select('id, nombre, categoria')
    .is('deleted_at', null)
    .order('nombre')
  if (prods.error) return { filas: [], error: prods.error.message }
  const base = (prods.data ?? []) as Record<string, unknown>[]
  const ids = base.map((p) => String(p.id))
  if (ids.length === 0) return { filas: [], error: null }

  let movs: Record<string, unknown>[] = []
  const movConUbic = await client
    .from('movimientos_inventario')
    .select('producto_id, tipo, cantidad, signo, fecha, ubicacion_origen, ubicacion_destino')
    .in('producto_id', ids)
    .is('deleted_at', null)
  if (!movConUbic.error) {
    movs = (movConUbic.data ?? []) as Record<string, unknown>[]
  } else if (/ubicacion/i.test(movConUbic.error.message)) {
    const movSin = await client
      .from('movimientos_inventario')
      .select('producto_id, tipo, cantidad, signo, fecha')
      .in('producto_id', ids)
      .is('deleted_at', null)
    if (!movSin.error) movs = (movSin.data ?? []) as Record<string, unknown>[]
  }
  const corte = Date.now() - 30 * 24 * 60 * 60 * 1000

  const filas = base.map((p) => {
    const id = String(p.id)
    const delProd = movs.filter((m) => String(m.producto_id) === id)
    let stock = 0
    let ultimaEntrada: string | null = null
    let ultimaSalida: string | null = null
    let rotacion = 0
    let casa = 0
    let stand = 0
    for (const m of delProd) {
      const tipo = String(m.tipo ?? '')
      const cant = Number(m.cantidad ?? 0)
      const signo = Number(m.signo ?? 0)
      const fecha = String(m.fecha ?? '')
      if (tipo !== 'transferencia') stock += cant * signo
      if (['compra', 'ajuste_positivo', 'devolucion_cliente', 'devolucion'].includes(tipo)) {
        if (!ultimaEntrada || fecha > ultimaEntrada) ultimaEntrada = fecha
      }
      if (['venta', 'merma', 'rotura', 'perdida', 'ajuste_negativo', 'consumo_interno'].includes(tipo)) {
        if (!ultimaSalida || fecha > ultimaSalida) ultimaSalida = fecha
      }
      if (tipo === 'venta' && new Date(fecha).getTime() >= corte) rotacion += cant
      const orig = m.ubicacion_origen == null ? '' : String(m.ubicacion_origen)
      const dest = m.ubicacion_destino == null ? '' : String(m.ubicacion_destino)
      if (tipo === 'transferencia' && signo === 1 && dest === 'Casa') casa += cant
      if (tipo === 'transferencia' && signo === -1 && orig === 'Casa') casa -= cant
      if (tipo === 'transferencia' && signo === 1 && dest === 'Stand') stand += cant
      if (tipo === 'transferencia' && signo === -1 && orig === 'Stand') stand -= cant
    }
    return {
      id,
      nombre: String(p.nombre ?? ''),
      categoria: p.categoria == null ? null : String(p.categoria),
      stock_actual: stock,
      ultima_entrada: ultimaEntrada,
      ultima_salida: ultimaSalida,
      rotacion_30: rotacion,
      stock_casa: casa,
      stock_stand: stand,
    }
  })
  return { filas, error: null }
}

export async function listarKardexProducto(
  client: SupabaseClient,
  productoId: string,
): Promise<{ filas: MovimientoKardex[]; error: string | null }> {
  const conUbic = await client
    .from('movimientos_inventario')
    .select('id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, ubicacion_origen, ubicacion_destino')
    .eq('producto_id', productoId)
    .is('deleted_at', null)
    .order('fecha', { ascending: true })
    .order('id', { ascending: true })
    .limit(800)

  let raw: Record<string, unknown>[] = []
  if (!conUbic.error) {
    raw = (conUbic.data ?? []) as Record<string, unknown>[]
  } else if (/ubicacion/i.test(conUbic.error.message)) {
    const sinUbic = await client
      .from('movimientos_inventario')
      .select('id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id')
      .eq('producto_id', productoId)
      .is('deleted_at', null)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .limit(800)
    if (sinUbic.error) return { filas: [], error: sinUbic.error.message }
    raw = (sinUbic.data ?? []) as Record<string, unknown>[]
  } else {
    return { filas: [], error: conUbic.error.message }
  }
  const userIds = [...new Set(raw.map((r) => String(r.usuario_id ?? '')).filter(Boolean))]
  const ventaIds = [
    ...new Set(
      raw.filter((r) => String(r.tipo) === 'venta' && r.referencia_id).map((r) => String(r.referencia_id)),
    ),
  ]

  const nombres = new Map<string, string>()
  if (userIds.length > 0) {
    const u = await client.from('usuarios').select('id, nombre').in('id', userIds)
    for (const row of u.data ?? []) {
      nombres.set(String(row.id), String(row.nombre ?? ''))
    }
  }
  const ventas = new Map<string, string>()
  if (ventaIds.length > 0) {
    const v = await client.from('ventas').select('id, fecha').in('id', ventaIds)
    for (const row of v.data ?? []) {
      ventas.set(String(row.id), String(row.fecha ?? ''))
    }
  }

  let saldo = 0
  const conSaldo: MovimientoKardex[] = raw.map((row) => {
    const tipo = String(row.tipo ?? '')
    const cant = Number(row.cantidad ?? 0)
    const signo = Number(row.signo ?? 0)
    if (tipo !== 'transferencia') saldo += cant * signo
    const ref = row.referencia_id == null ? null : String(row.referencia_id)
    return {
      id: String(row.id),
      tipo,
      cantidad: cant,
      signo,
      motivo: row.motivo == null || row.motivo === '' ? null : String(row.motivo),
      fecha: String(row.fecha ?? ''),
      referenciaId: ref,
      usuarioNombre: nombres.get(String(row.usuario_id ?? '')) || '—',
      saldo,
      ubicacionOrigen: row.ubicacion_origen == null ? null : String(row.ubicacion_origen),
      ubicacionDestino: row.ubicacion_destino == null ? null : String(row.ubicacion_destino),
      ventaFecha: ref ? ventas.get(ref) ?? null : null,
    }
  })
  return { filas: conSaldo.reverse(), error: null }
}

export async function registrarTraslado(
  client: SupabaseClient,
  input: {
    productoId: string
    cantidad: number
    origen: string
    destino: string
    fecha: string
    notas: string
  },
): Promise<string | null> {
  const { error } = await client.rpc('registrar_traslado', {
    p_producto_id: input.productoId,
    p_cantidad: input.cantidad,
    p_origen: input.origen,
    p_destino: input.destino,
    p_fecha: input.fecha ? new Date(input.fecha).toISOString() : new Date().toISOString(),
    p_notas: input.notas,
  })
  if (!error) return null
  const msg = error.message
  if (/NO_AUTORIZADO/i.test(msg)) return 'No tenés permiso para registrar traslados'
  if (/UBICACION/i.test(msg)) return 'Elegí origen y destino distintos y válidos'
  if (/CANTIDAD/i.test(msg)) return 'La cantidad tiene que ser un número positivo'
  if (/does not exist|schema cache|PGRST202/i.test(msg)) {
    return 'Falta correr supabase/032_inventario_movimientos.sql en el SQL Editor (rol postgres).'
  }
  return 'No se pudo registrar el traslado'
}
