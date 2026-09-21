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

const PAGE = 1000

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

async function auditarEmpresa(nombre: string, empresaId: string) {
  console.log(bold(`\n═══════════════════════════════════════`))
  console.log(bold(`  AUDITORÍA — ${nombre.toUpperCase()}`))
  console.log(bold(`═══════════════════════════════════════\n`))

  let errores = 0
  let advertencias = 0

  const { data: productos, error: errProd } = await supabase
    .from('productos')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .is('deleted_at', null)

  if (errProd) throw new Error(errProd.message)

  if (productos) {
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
        console.log(rojo(`  ❌ Stock negativo: ${prod.nombre} (${stock})`))
        errores++
      }
    }
    if (stocksNegativos === 0) {
      console.log(verde(`  ✅ Stock positivo en todos los productos`))
    }
  }

  const { data: movGrandes, error: errMov } = await supabase
    .from('movimientos_inventario')
    .select('tipo, cantidad, fecha, producto_id')
    .eq('empresa_id', empresaId)
    .is('deleted_at', null)
    .gt('cantidad', 500)
    .order('cantidad', { ascending: false })
    .limit(10)

  if (errMov) throw new Error(errMov.message)

  if (movGrandes && movGrandes.length > 0) {
    console.log(rojo(`\n  ❌ Movimientos con cantidades sospechosas (>500):`))
    for (const m of movGrandes) {
      console.log(rojo(`     ${m.tipo}: ${m.cantidad} unidades — ${m.fecha}`))
      errores++
    }
  } else {
    console.log(verde(`  ✅ Sin movimientos con cantidades imposibles`))
  }

  const { count: ventasSinUbicacion, error: errUbic } = await supabase
    .from('movimientos_inventario')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('tipo', 'venta')
    .is('deleted_at', null)
    .is('ubicacion_origen', null)

  if (errUbic) throw new Error(errUbic.message)

  if (ventasSinUbicacion && ventasSinUbicacion > 0) {
    console.log(amarillo(`\n  ⚠️  ${ventasSinUbicacion} ventas sin ubicación asignada`))
    advertencias++
  } else {
    console.log(verde(`  ✅ Todas las ventas tienen ubicación`))
  }

  const ventaIds = (
    await paginar<{ id: string }>((from, to) =>
      supabase
        .from('ventas')
        .select('id')
        .eq('empresa_id', empresaId)
        .is('deleted_at', null)
        .range(from, to),
    )
  ).map((v) => v.id)

  const items: { precio_unitario: number; costo_unitario: number | null; cantidad: number }[] = []
  for (let i = 0; i < ventaIds.length && items.length < 500; i += 100) {
    const chunk = ventaIds.slice(i, i + 100)
    const { data: filas, error } = await supabase
      .from('ventas_items')
      .select('precio_unitario, costo_unitario, cantidad')
      .in('venta_id', chunk)
      .limit(500 - items.length)
    if (error) throw new Error(error.message)
    items.push(...((filas ?? []) as typeof items))
  }

  if (items.length > 0) {
    const ingresos = items.reduce((acc, v) => acc + Number(v.precio_unitario) * Number(v.cantidad), 0)
    const costos = items.reduce((acc, v) => acc + (Number(v.costo_unitario) || 0) * Number(v.cantidad), 0)
    const margenNum = ingresos > 0 ? ((ingresos - costos) / ingresos) * 100 : 0
    const margen = costos > 0 ? margenNum.toFixed(1) : 'Sin costos'

    if (costos === 0) {
      console.log(amarillo(`\n  ⚠️  Margen: Sin costos cargados (0%)`))
      advertencias++
    } else if (margenNum > 90) {
      console.log(rojo(`\n  ❌ Margen sospechoso: ${margen}% (posible error de costos)`))
      errores++
    } else {
      console.log(verde(`\n  ✅ Margen promedio: ${margen}%`))
    }
  }

  const { data: duplicadas, error: errDup } = await supabase
    .from('ventas')
    .select('fecha, total_con_interes, cliente_nombre')
    .eq('empresa_id', empresaId)
    .is('deleted_at', null)
    .order('fecha', { ascending: false })
    .limit(200)

  if (errDup) throw new Error(errDup.message)

  if (duplicadas) {
    const grupos: Record<string, number> = {}
    for (const v of duplicadas) {
      const key = `${String(v.fecha ?? '').split('T')[0]}_${v.total_con_interes}_${v.cliente_nombre}`
      grupos[key] = (grupos[key] || 0) + 1
    }
    const dupls = Object.entries(grupos).filter(([, count]) => count > 1)
    if (dupls.length > 0) {
      console.log(amarillo(`\n  ⚠️  ${dupls.length} posibles ventas duplicadas detectadas`))
      advertencias++
    } else {
      console.log(verde(`  ✅ Sin ventas duplicadas detectadas`))
    }
  }

  const { count: sinCosto, error: errCosto } = await supabase
    .from('productos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .is('deleted_at', null)
    .eq('costo', 0)

  if (errCosto) throw new Error(errCosto.message)

  if (sinCosto && sinCosto > 0) {
    console.log(amarillo(`\n  ⚠️  ${sinCosto} productos sin costo cargado`))
    advertencias++
  } else {
    console.log(verde(`  ✅ Todos los productos tienen costo`))
  }

  console.log(bold(`\n───────────────────────────────────────`))
  console.log(bold(`  RESUMEN`))
  console.log(bold(`───────────────────────────────────────`))
  if (errores === 0 && advertencias === 0) {
    console.log(verde(`  🎉 Todo perfecto — sin errores ni advertencias`))
  } else {
    if (errores > 0) console.log(rojo(`  ❌ ${errores} error(es) crítico(s)`))
    if (advertencias > 0) console.log(amarillo(`  ⚠️  ${advertencias} advertencia(s)`))
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
