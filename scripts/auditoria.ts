import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey || serviceKey === 'tu_service_role_key_de_supabase') {
  console.error(
    '\x1b[31mFalta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.\n' +
      'La service_role key está en Supabase → Settings → API → service_role.\x1b[0m',
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const verde = (t: string) => `\x1b[32m${t}\x1b[0m`
const rojo = (t: string) => `\x1b[31m${t}\x1b[0m`
const amarillo = (t: string) => `\x1b[33m${t}\x1b[0m`
const bold = (t: string) => `\x1b[1m${t}\x1b[0m`

const EMPRESAS: Record<string, string> = {
  acacia: '47d60e49-bf3b-4ca4-915f-3269c5fdbcf9',
  analitica: '345d45eb-a7c1-4099-9108-c6830db7a70a',
}

const UMBRAL_CANTIDAD_MOVIMIENTO: Record<string, number> = {
  analitica: 50_000,
}
const UMBRAL_CANTIDAD_DEFAULT = 500

const FORMAS_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
  qr: 'Mercado Pago QR',
  mp_qr: 'Mercado Pago QR',
}

const PAGE = 1000
const CHUNK = 100

type Totales = { errores: number; advertencias: number }

function ok(msg: string) {
  console.log(verde(`  ✅ ${msg}`))
}
function warn(totales: Totales, msg: string) {
  console.log(amarillo(`  ⚠️  ${msg}`))
  totales.advertencias++
}
function fail(totales: Totales, msg: string) {
  console.log(rojo(`  ❌ ${msg}`))
  totales.errores++
}
function titulo(msg: string) {
  console.log(bold(`\n${msg}`))
}

function isoHace(dias: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString()
}

function texto(v: unknown) {
  if (v == null) return ''
  return String(v).trim()
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function totalVenta(v: { total_con_interes?: unknown; total_sin_interes?: unknown }) {
  const con = num(v.total_con_interes)
  if (con > 0) return con
  return num(v.total_sin_interes)
}

async function paginar<T>(cargar: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await cargar(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const filas = data ?? []
    out.push(...filas)
    if (filas.length < PAGE) break
    from += PAGE
  }
  return out
}

async function enChunks<T>(ids: string[], cargar: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    out.push(...(await cargar(ids.slice(i, i + CHUNK))))
  }
  return out
}

type ProductoRow = {
  id: string
  nombre: string
  categoria: string | null
  categoria_id: string | null
  activo: boolean | null
  precio_venta: number | null
  costo: number | null
}

async function bloqProductos(empresaId: string, productos: ProductoRow[], totales: Totales) {
  titulo('📦 PRODUCTOS')

  const activos = productos.filter((p) => p.activo !== false)
  const inactivos = productos.length - activos.length
  ok(`${activos.length} productos activos · ${inactivos} inactivos`)

  const sinCat = activos.filter((p) => !texto(p.categoria) && !texto(p.categoria_id))
  if (sinCat.length > 0) warn(totales, `${sinCat.length} productos sin categoría asignada`)
  else ok('Todos los productos activos tienen categoría')

  const sinPrecio = activos.filter((p) => num(p.precio_venta) <= 0)
  if (sinPrecio.length > 0) fail(totales, `${sinPrecio.length} productos sin precio de venta`)
  else ok('Todos los productos activos tienen precio de venta')

  const margenNeg = activos.filter((p) => num(p.precio_venta) > 0 && num(p.costo) > 0 && num(p.precio_venta) < num(p.costo))
  if (margenNeg.length > 0) fail(totales, `${margenNeg.length} productos con precio menor al costo`)
  else ok('Ningún producto activo tiene margen negativo')

  const sinCosto = productos.filter((p) => num(p.costo) <= 0)
  if (sinCosto.length > 0) warn(totales, `${sinCosto.length} productos sin costo cargado`)
  else ok('Todos los productos tienen costo')

  const desde90 = isoHace(90)
  const ventasRecientes = await paginar<{ id: string }>((from, to) =>
    supabase
      .from('ventas')
      .select('id')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .gte('fecha', desde90)
      .range(from, to),
  )
  const idsVendidos = new Set<string>()
  if (ventasRecientes.length > 0) {
    const items = await enChunks(ventasRecientes.map((v) => v.id), async (chunk) => {
      const { data, error } = await supabase.from('ventas_items').select('producto_id').in('venta_id', chunk)
      if (error) throw new Error(error.message)
      return (data ?? []) as { producto_id: string }[]
    })
    for (const it of items) {
      if (it.producto_id) idsVendidos.add(String(it.producto_id))
    }
  }
  const sinRotacion = activos.filter((p) => !idsVendidos.has(p.id))
  if (activos.length === 0) ok('Sin productos activos para evaluar rotación')
  else if (sinRotacion.length > 0) {
    warn(totales, `${sinRotacion.length} productos activos sin ventas en los últimos 90 días`)
  } else ok('Todos los productos activos tuvieron ventas en los últimos 90 días')

  const variantes = await paginar<{ id: string; producto_id: string; activo: boolean | null }>((from, to) =>
    supabase
      .from('producto_variantes')
      .select('id, producto_id, activo')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .range(from, to),
  )
  const porProducto = new Map<string, string[]>()
  for (const v of variantes) {
    if (v.activo === false) continue
    const pid = String(v.producto_id)
    const arr = porProducto.get(pid) ?? []
    arr.push(String(v.id))
    porProducto.set(pid, arr)
  }
  const varianteIds = [...porProducto.values()].flat()
  const stockVar = new Map<string, number>()
  if (varianteIds.length > 0) {
    const movs = await paginar<{ variante_id: string | null; cantidad: number; signo: number; tipo: string }>((from, to) =>
      supabase
        .from('movimientos_inventario')
        .select('variante_id, cantidad, signo, tipo')
        .eq('empresa_id', empresaId)
        .is('deleted_at', null)
        .not('variante_id', 'is', null)
        .range(from, to),
    )
    for (const m of movs) {
      if (String(m.tipo ?? '') === 'transferencia') continue
      const id = String(m.variante_id ?? '')
      if (!id) continue
      stockVar.set(id, (stockVar.get(id) ?? 0) + num(m.cantidad) * num(m.signo))
    }
  }
  let sinStockVar = 0
  for (const [pid, ids] of porProducto) {
    if (!activos.some((p) => p.id === pid)) continue
    const total = ids.reduce((acc, id) => acc + (stockVar.get(id) ?? 0), 0)
    if (total <= 0) sinStockVar++
  }
  if (porProducto.size === 0) ok('No hay productos con variantes')
  else if (sinStockVar > 0) warn(totales, `${sinStockVar} productos con variantes pero sin stock en ninguna variante`)
  else ok('Los productos con variantes tienen stock en al menos una variante')
}

async function bloqCompras(empresaId: string, totales: Totales) {
  titulo('🛒 COMPRAS')

  const compras = await paginar<{
    id: string
    fecha: string
    proveedor: string | null
    proveedor_id: string | null
    total: number | null
  }>((from, to) =>
    supabase
      .from('compras')
      .select('id, fecha, proveedor, proveedor_id, total')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .range(from, to),
  )

  if (compras.length === 0) {
    ok('Sin compras registradas')
  } else {
    const sinProv = compras.filter((c) => !texto(c.proveedor) && !texto(c.proveedor_id))
    if (sinProv.length > 0) warn(totales, `${sinProv.length} compras sin proveedor asignado`)
    else ok('Todas las compras tienen proveedor')

    const items = await enChunks(compras.map((c) => c.id), async (chunk) => {
      const { data, error } = await supabase
        .from('compras_items')
        .select('compra_id, costo_unitario')
        .in('compra_id', chunk)
      if (error) throw new Error(error.message)
      return (data ?? []) as { compra_id: string; costo_unitario: number | null }[]
    })
    const itemsPorCompra = new Map<string, { compra_id: string; costo_unitario: number | null }[]>()
    for (const it of items) {
      const arr = itemsPorCompra.get(it.compra_id) ?? []
      arr.push(it)
      itemsPorCompra.set(it.compra_id, arr)
    }
    const huerfanas = compras.filter((c) => (itemsPorCompra.get(c.id) ?? []).length === 0)
    if (huerfanas.length > 0) fail(totales, `${huerfanas.length} compras sin items registrados`)
    else ok('Todas las compras tienen items')

    const sinCostoItem = compras.filter((c) => {
      const its = itemsPorCompra.get(c.id) ?? []
      return its.length > 0 && its.some((i) => num(i.costo_unitario) <= 0)
    })
    if (sinCostoItem.length > 0) {
      warn(totales, `${sinCostoItem.length} compras con costo unitario = 0 (impacta el margen de Analytics)`)
    } else ok('Todas las compras tienen costo unitario en sus items')

    const grupos: Record<string, number> = {}
    for (const c of compras) {
      const prov = texto(c.proveedor) || texto(c.proveedor_id)
      if (!prov) continue
      const key = `${String(c.fecha ?? '').slice(0, 10)}_${num(c.total)}_${prov}`
      grupos[key] = (grupos[key] || 0) + 1
    }
    const dupls = Object.values(grupos).filter((n) => n > 1).length
    if (dupls > 0) warn(totales, `${dupls} posibles compras duplicadas (mismo proveedor, total y día)`)
    else ok('Sin compras duplicadas detectadas')
  }

  const limiteOc = isoHace(30).slice(0, 10)
  const { data: ocs, error: errOc } = await supabase
    .from('ordenes_compra')
    .select('id, fecha_emision, created_at')
    .eq('empresa_id', empresaId)
    .eq('estado', 'borrador')
    .is('deleted_at', null)

  if (errOc) {
    warn(totales, `No se pudieron leer órdenes de compra (${errOc.message})`)
  } else {
    const olvidadas = (ocs ?? []).filter((o) => {
      const emision = String(o.fecha_emision ?? o.created_at ?? '').slice(0, 10)
      return emision !== '' && emision <= limiteOc
    })
    if (olvidadas.length > 0) {
      warn(totales, `${olvidadas.length} órdenes de compra en borrador hace más de 30 días`)
    } else ok('No hay órdenes de compra en borrador olvidadas')
  }
}

async function bloqVentas(empresaId: string, totales: Totales) {
  titulo('💰 VENTAS')

  const ventas = await paginar<{
    id: string
    fecha: string
    total_con_interes: number | null
    total_sin_interes: number | null
    cliente_id: string | null
    cliente_nombre: string | null
    forma_pago: string | null
  }>((from, to) =>
    supabase
      .from('ventas')
      .select('id, fecha, total_con_interes, total_sin_interes, cliente_id, cliente_nombre, forma_pago')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .range(from, to),
  )

  if (ventas.length === 0) {
    ok('Sin ventas registradas')
    return
  }

  const totalCero = ventas.filter((v) => totalVenta(v) <= 0)
  if (totalCero.length > 0) fail(totales, `${totalCero.length} ventas con total = 0 o null`)
  else ok('Todas las ventas tienen total mayor a 0')

  const items = await enChunks(ventas.map((v) => v.id), async (chunk) => {
    const { data, error } = await supabase
      .from('ventas_items')
      .select('venta_id, costo_unitario, precio_unitario, cantidad')
      .in('venta_id', chunk)
    if (error) throw new Error(error.message)
    return (data ?? []) as {
      venta_id: string
      costo_unitario: number | null
      precio_unitario: number | null
      cantidad: number | null
    }[]
  })
  const itemsPorVenta = new Map<string, typeof items>()
  for (const it of items) {
    const arr = itemsPorVenta.get(it.venta_id) ?? []
    arr.push(it)
    itemsPorVenta.set(it.venta_id, arr)
  }
  const huerfanas = ventas.filter((v) => (itemsPorVenta.get(v.id) ?? []).length === 0)
  if (huerfanas.length > 0) fail(totales, `${huerfanas.length} ventas sin items registrados`)
  else ok('Todas las ventas tienen items')

  const sinCostoItem = ventas.filter((v) => {
    const its = itemsPorVenta.get(v.id) ?? []
    return its.length > 0 && its.some((i) => num(i.costo_unitario) <= 0)
  })
  if (sinCostoItem.length > 0) {
    warn(totales, `${sinCostoItem.length} ventas con costo_unitario = 0 (impacta el margen en Analytics)`)
  } else ok('Todas las ventas tienen costo unitario en sus items')

  if (items.length > 0) {
    const ingresos = items.reduce((acc, v) => acc + num(v.precio_unitario) * num(v.cantidad), 0)
    const costos = items.reduce((acc, v) => acc + num(v.costo_unitario) * num(v.cantidad), 0)
    const margenNum = ingresos > 0 ? ((ingresos - costos) / ingresos) * 100 : 0
    if (costos === 0) warn(totales, 'Margen: sin costos cargados (0%)')
    else if (margenNum > 90) fail(totales, `Margen sospechoso: ${margenNum.toFixed(1)}% (posible error de costos)`)
    else ok(`Margen promedio: ${margenNum.toFixed(1)}%`)
  }

  const grupos: Record<string, number> = {}
  for (const v of ventas.slice(0, 200).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))) {
    const cliente = texto(v.cliente_nombre)
    if (!cliente) continue
    const key = `${String(v.fecha ?? '').split('T')[0]}_${totalVenta(v)}_${cliente}`
    grupos[key] = (grupos[key] || 0) + 1
  }
  const dupls = Object.values(grupos).filter((n) => n > 1).length
  if (dupls > 0) warn(totales, `${dupls} posibles ventas duplicadas detectadas`)
  else ok('Sin ventas duplicadas detectadas')

  const conCliente = ventas.filter((v) => texto(v.cliente_id) || texto(v.cliente_nombre)).length
  const pctCliente = ventas.length > 0 ? (conCliente / ventas.length) * 100 : 0
  const msgCrm = `${pctCliente.toFixed(0)}% de ventas con cliente asignado (${conCliente}/${ventas.length})`
  if (pctCliente < 20) warn(totales, msgCrm)
  else ok(msgCrm)

  const ahora = Date.now()
  const msDia = 86400000
  const mesActual = ventas.filter((v) => ahora - Date.parse(v.fecha) <= 30 * msDia)
  const mesAnt = ventas.filter((v) => {
    const age = ahora - Date.parse(v.fecha)
    return age > 30 * msDia && age <= 60 * msDia
  })
  const ticket = (filas: typeof ventas) => {
    if (filas.length === 0) return 0
    return filas.reduce((acc, v) => acc + totalVenta(v), 0) / filas.length
  }
  const tActual = ticket(mesActual)
  const tAnt = ticket(mesAnt)
  if (mesActual.length === 0) warn(totales, 'Sin ventas en el último mes para calcular ticket promedio')
  else if (tAnt === 0) ok(`Ticket promedio último mes: ${tActual.toFixed(0)} (sin mes anterior comparable)`)
  else {
    const varPct = ((tActual - tAnt) / tAnt) * 100
    const msg = `Ticket promedio último mes ${tActual.toFixed(0)} vs mes anterior ${tAnt.toFixed(0)} (${varPct >= 0 ? '+' : ''}${varPct.toFixed(0)}%)`
    if (varPct <= -20) warn(totales, msg)
    else ok(msg)
  }

  const porForma = new Map<string, number>()
  for (const v of ventas) {
    const id = texto(v.forma_pago) || 'sin_dato'
    porForma.set(id, (porForma.get(id) ?? 0) + 1)
  }
  const top = [...porForma.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top) {
    const label = FORMAS_PAGO[top[0]] ?? top[0]
    const pct = (top[1] / ventas.length) * 100
    ok(`Forma de pago más usada: ${label} (${pct.toFixed(0)}% de las ventas)`)
  }
}

async function auditarEmpresa(nombre: string, empresaId: string) {
  console.log(bold(`\n═══════════════════════════════════════`))
  console.log(bold(`  AUDITORÍA — ${nombre.toUpperCase()}`))
  console.log(bold(`═══════════════════════════════════════\n`))

  const totales: Totales = { errores: 0, advertencias: 0 }

  const productos = await paginar<ProductoRow>((from, to) =>
    supabase
      .from('productos')
      .select('id, nombre, categoria, categoria_id, activo, precio_venta, costo')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .range(from, to),
  )

  if (productos.length > 0) {
    const movs = await paginar<{ producto_id: string; signo: number; cantidad: number }>((from, to) =>
      supabase
        .from('movimientos_inventario')
        .select('producto_id, signo, cantidad')
        .eq('empresa_id', empresaId)
        .is('deleted_at', null)
        .range(from, to),
    )

    const porProd = new Map<string, number>()
    for (const m of movs) {
      const id = String(m.producto_id)
      porProd.set(id, (porProd.get(id) ?? 0) + Number(m.signo) * Number(m.cantidad))
    }

    let stocksNegativos = 0
    for (const prod of productos) {
      const stock = porProd.get(prod.id) ?? 0
      if (stock < 0) {
        stocksNegativos++
        fail(totales, `Stock negativo: ${prod.nombre} (${stock})`)
      }
    }
    if (stocksNegativos === 0) ok('Stock positivo en todos los productos')
  }

  const umbralCantidad = UMBRAL_CANTIDAD_MOVIMIENTO[nombre] ?? UMBRAL_CANTIDAD_DEFAULT
  const { data: movGrandes, error: errMov } = await supabase
    .from('movimientos_inventario')
    .select('tipo, cantidad, fecha, producto_id')
    .eq('empresa_id', empresaId)
    .is('deleted_at', null)
    .gt('cantidad', umbralCantidad)
    .order('cantidad', { ascending: false })
    .limit(10)

  if (errMov) throw new Error(errMov.message)

  if (movGrandes && movGrandes.length > 0) {
    fail(totales, `Movimientos con cantidades sospechosas (>${umbralCantidad}):`)
    for (const m of movGrandes) {
      console.log(rojo(`     ${m.tipo}: ${m.cantidad} unidades — ${m.fecha}`))
      totales.errores++
    }
  } else {
    ok(`Sin movimientos con cantidades imposibles (>${umbralCantidad})`)
  }

  const { count: ventasSinUbicacion, error: errUbic } = await supabase
    .from('movimientos_inventario')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('tipo', 'venta')
    .is('deleted_at', null)
    .is('ubicacion_origen', null)

  if (errUbic) throw new Error(errUbic.message)

  const { count: ventasMovTotal, error: errVentasMov } = await supabase
    .from('movimientos_inventario')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('tipo', 'venta')
    .is('deleted_at', null)

  if (errVentasMov) throw new Error(errVentasMov.message)

  const sinUbic = ventasSinUbicacion ?? 0
  const totalVentasMov = ventasMovTotal ?? 0
  const pctSinUbic = totalVentasMov > 0 ? (sinUbic / totalVentasMov) * 100 : 0

  if (sinUbic === 0) {
    ok('Todas las ventas tienen ubicación')
  } else if (pctSinUbic > 90) {
    warn(totales, `${sinUbic} ventas sin ubicación (${pctSinUbic.toFixed(0)}%) — típico de empresa de prueba`)
  } else {
    fail(totales, `${sinUbic} ventas sin ubicación asignada (${pctSinUbic.toFixed(0)}%)`)
  }

  await bloqProductos(empresaId, productos, totales)
  await bloqCompras(empresaId, totales)
  await bloqVentas(empresaId, totales)

  console.log(bold(`\n───────────────────────────────────────`))
  console.log(bold(`  RESUMEN`))
  console.log(bold(`───────────────────────────────────────`))
  if (totales.errores === 0 && totales.advertencias === 0) {
    console.log(verde(`  🎉 Todo perfecto — sin errores ni advertencias`))
  } else {
    if (totales.errores > 0) console.log(rojo(`  ❌ ${totales.errores} error(es) crítico(s)`))
    if (totales.advertencias > 0) console.log(amarillo(`  ⚠️  ${totales.advertencias} advertencia(s)`))
  }
  console.log()
}

async function main() {
  const arg = process.argv[2]

  if (arg && arg.startsWith('--empresa=')) {
    const nombre = arg.replace('--empresa=', '')
    const id = EMPRESAS[nombre]
    if (!id) {
      console.log(rojo(`Empresa "${nombre}" no encontrada. Opciones: ${Object.keys(EMPRESAS).join(', ')}`))
      process.exit(1)
    }
    await auditarEmpresa(nombre, id)
  } else {
    for (const [nombre, id] of Object.entries(EMPRESAS)) {
      await auditarEmpresa(nombre, id)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
