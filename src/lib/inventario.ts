import type { SupabaseClient } from '@supabase/supabase-js'
import { etiquetaCombo } from './variantes'

export { listarUbicaciones, type UbicacionFila } from './ubicaciones'

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
  precioUnitario: number | null
  varianteEtiqueta: string | null
  numeroLote: string | null
}

const BADGE_ENTRADA = { fondo: '#14532D', color: '#4ADE80' }
const BADGE_SALIDA = { fondo: '#7F1D1D', color: '#F87171' }

export function estiloTipoMovimiento(tipo: string, signo: number) {
  const t = tipo.toLowerCase()
  const positivo =
    t === 'compra' ||
    t === 'devolucion_cliente' ||
    t === 'devolucion' ||
    t === 'ajuste_positivo' ||
    signo === 1
  if (t === 'compra') {
    return { icono: '🛒', texto: 'Compra', clase: 'text-[#4ADE80]', ...BADGE_ENTRADA }
  }
  if (t === 'venta') {
    return { icono: '💸', texto: 'Venta', clase: 'text-[#F87171]', ...BADGE_SALIDA }
  }
  if (t === 'devolucion_cliente' || t === 'devolucion') {
    return { icono: '↩️', texto: 'Devolución cliente', clase: 'text-[#93C5FD]', fondo: '#1E3A5F', color: '#93C5FD' }
  }
  if (t === 'devolucion_proveedor') {
    return { icono: '🏭', texto: 'Devolución proveedor', clase: 'text-[#F87171]', ...BADGE_SALIDA }
  }
  if (t === 'ajuste_positivo') {
    return { icono: '📦', texto: 'Ajuste +', clase: 'text-[#4ADE80]', ...BADGE_ENTRADA }
  }
  if (t === 'consumo_interno') {
    return { icono: '🎁', texto: 'Consumo interno', clase: 'text-[#FCD34D]', fondo: '#422006', color: '#FCD34D' }
  }
  if (t === 'transferencia') {
    return {
      icono: '🔁',
      texto: signo === 1 ? 'Traslado (entra)' : 'Traslado (sale)',
      clase: 'text-[#C4B5FD]',
      fondo: '#312E81',
      color: '#C4B5FD',
    }
  }
  if (t === 'ajuste_negativo' || t === 'merma' || t === 'rotura' || t === 'perdida') {
    const label =
      t === 'ajuste_negativo' ? 'Ajuste −' : t === 'rotura' ? 'Rotura' : t === 'merma' ? 'Merma' : 'Pérdida'
    return { icono: '⚠️', texto: label, clase: 'text-[#F87171]', ...BADGE_SALIDA }
  }
  return {
    icono: '•',
    texto: tipo,
    clase: positivo ? 'text-[#4ADE80]' : 'text-[#F87171]',
    fondo: positivo ? BADGE_ENTRADA.fondo : BADGE_SALIDA.fondo,
    color: positivo ? BADGE_ENTRADA.color : BADGE_SALIDA.color,
  }
}

export function formatoFechaMov(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function textoKardexConLote(m: {
  signo: number
  cantidad: number
  fecha: string
  numeroLote: string | null
}) {
  const lado = m.signo >= 0 ? 'Entrada' : 'Salida'
  const fecha = formatoFechaMov(m.fecha).split(',')[0]?.trim() ?? formatoFechaMov(m.fecha)
  const lote = m.numeroLote ? ` · Lote ${m.numeroLote}` : ''
  return `${lado}: ${m.cantidad}u${lote} · ${fecha}`
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
      if (['venta', 'merma', 'rotura', 'perdida', 'ajuste_negativo', 'consumo_interno', 'devolucion_proveedor'].includes(tipo)) {
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

function deltaStockKardex(tipo: string, cantidad: number, signo: number) {
  if (tipo === 'transferencia') return 0
  return cantidad * signo
}

export async function listarKardexProducto(
  client: SupabaseClient,
  productoId: string,
  input: { pagina: number; pageSize: number; stockActual: number },
): Promise<{ filas: MovimientoKardex[]; total: number; error: string | null }> {
  const from = (input.pagina - 1) * input.pageSize
  const to = from + input.pageSize - 1
  const colsConUbic =
    'id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, ubicacion_origen, ubicacion_destino, precio_unitario, costo_unitario, variante_id, lote_id'
  const colsSinUbic =
    'id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, precio_unitario, costo_unitario, variante_id, lote_id'

  const pedirPagina = (cols: string) =>
    client
      .from('movimientos_inventario')
      .select(cols, { count: 'exact' })
      .eq('producto_id', productoId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

  let pagina = await pedirPagina(colsConUbic)
  if (pagina.error && /ubicacion/i.test(pagina.error.message)) {
    pagina = await pedirPagina(colsSinUbic)
  }
  if (pagina.error && /(precio_unitario|costo_unitario)/i.test(pagina.error.message)) {
    pagina = await pedirPagina(
      'id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, ubicacion_origen, ubicacion_destino',
    )
    if (pagina.error && /ubicacion/i.test(pagina.error.message)) {
      pagina = await pedirPagina('id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id')
    }
  }
  if (pagina.error && /variante_id/i.test(pagina.error.message)) {
    pagina = await pedirPagina(
      'id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, ubicacion_origen, ubicacion_destino, precio_unitario, costo_unitario, lote_id',
    )
  }
  if (pagina.error && /lote_id/i.test(pagina.error.message)) {
    pagina = await pedirPagina(
      'id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, ubicacion_origen, ubicacion_destino, precio_unitario, costo_unitario, variante_id',
    )
    if (pagina.error && /variante_id/i.test(pagina.error.message)) {
      pagina = await pedirPagina(
        'id, tipo, cantidad, signo, motivo, fecha, referencia_id, usuario_id, ubicacion_origen, ubicacion_destino, precio_unitario, costo_unitario',
      )
    }
  }
  if (pagina.error) return { filas: [], total: 0, error: pagina.error.message }

  const raw = (pagina.data ?? []) as unknown as Record<string, unknown>[]
  const total = pagina.count ?? 0

  let netNewer = 0
  if (from > 0) {
    const saltados = await client
      .from('movimientos_inventario')
      .select('tipo, cantidad, signo')
      .eq('producto_id', productoId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .range(0, from - 1)
    if (!saltados.error) {
      for (const row of (saltados.data ?? []) as Record<string, unknown>[]) {
        netNewer += deltaStockKardex(String(row.tipo ?? ''), Number(row.cantidad ?? 0), Number(row.signo ?? 0))
      }
    }
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

  const varianteIds = [...new Set(raw.map((r) => (r.variante_id == null ? '' : String(r.variante_id))).filter(Boolean))]
  const etiquetasVar = new Map<string, string>()
  if (varianteIds.length > 0) {
    const vr = await client.from('producto_variantes').select('id, atributos').in('id', varianteIds)
    for (const row of (vr.data ?? []) as Record<string, unknown>[]) {
      const attrs = (row.atributos ?? {}) as Record<string, string>
      etiquetasVar.set(String(row.id), etiquetaCombo(attrs))
    }
  }

  const loteIds = [...new Set(raw.map((r) => (r.lote_id == null ? '' : String(r.lote_id))).filter(Boolean))]
  const numerosLote = new Map<string, string>()
  if (loteIds.length > 0) {
    const lr = await client.from('lotes').select('id, numero_lote').in('id', loteIds)
    for (const row of (lr.data ?? []) as Record<string, unknown>[]) {
      numerosLote.set(String(row.id), String(row.numero_lote ?? ''))
    }
  }

  let saldo = Number(input.stockActual) - netNewer
  const filas: MovimientoKardex[] = raw.map((row) => {
    const tipo = String(row.tipo ?? '')
    const cant = Number(row.cantidad ?? 0)
    const signo = Number(row.signo ?? 0)
    const ref = row.referencia_id == null ? null : String(row.referencia_id)
    const item: MovimientoKardex = {
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
      precioUnitario: (() => {
        const precio = Number(row.precio_unitario ?? 0)
        const costo = Number(row.costo_unitario ?? 0)
        if (precio > 0) return precio
        if (costo > 0) return costo
        return null
      })(),
      varianteEtiqueta: row.variante_id ? etiquetasVar.get(String(row.variante_id)) ?? null : null,
      numeroLote: row.lote_id ? numerosLote.get(String(row.lote_id)) ?? null : null,
    }
    saldo -= deltaStockKardex(tipo, cant, signo)
    return item
  })
  return { filas, total, error: null }
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
