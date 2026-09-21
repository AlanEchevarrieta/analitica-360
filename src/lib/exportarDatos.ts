import type { SupabaseClient } from '@supabase/supabase-js'
import { listarClientes } from './clientes'
import { formatoFechaCompra } from './compras'
import { CATEGORIAS_GASTO } from './gastos'
import { estiloTipoMovimiento } from './inventario'
import { listarProductos } from './productos'
import { etiquetaFormaPago, formatoFechaVenta } from './ventas'

function slugEmpresa(nombre: string) {
  const s = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return s || 'empresa'
}

function fechaArchivo() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

async function bajarExcel(nombre: string, hojas: { nombre: string; filas: Record<string, unknown>[] }[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const hoja of hojas) {
    const ws = XLSX.utils.json_to_sheet(hoja.filas.length > 0 ? hoja.filas : [{ Aviso: 'Sin datos' }])
    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre.slice(0, 31))
  }
  XLSX.writeFile(wb, nombre)
}

async function paginar<T>(
  pedir: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ filas: T[]; error: string | null }> {
  const PAGE = 500
  const filas: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await pedir(from, from + PAGE - 1)
    if (error) return { filas: [], error: error.message }
    const chunk = data ?? []
    filas.push(...chunk)
    if (chunk.length < PAGE) break
  }
  return { filas, error: null }
}

export async function exportarDatosVentas(client: SupabaseClient, empresa: string) {
  const ventas = await paginar((from, to) =>
    client
      .from('ventas')
      .select(
        'id, numero_venta, fecha, forma_pago, cliente_nombre, cuotas, descuento, total_sin_interes, total_con_interes, notas, deleted_at, monto_senia, saldo_pendiente, estado_cobro',
      )
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .range(from, to),
  )
  if (ventas.error) {
    const retry = await paginar((from, to) =>
      client
        .from('ventas')
        .select(
          'id, numero_venta, fecha, forma_pago, cliente_nombre, cuotas, descuento, total_sin_interes, total_con_interes, notas, deleted_at',
        )
        .is('deleted_at', null)
        .order('fecha', { ascending: false })
        .range(from, to),
    )
    if (retry.error) throw new Error(retry.error)
    ventas.filas = retry.filas as typeof ventas.filas
  }
  const ids = ventas.filas.map((v) => String((v as Record<string, unknown>).id))
  const items: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await client
      .from('ventas_items')
      .select('venta_id, cantidad, precio_unitario, productos(nombre)')
      .in('venta_id', ids.slice(i, i + 200))
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
      const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
      items.push({
        venta_id: row.venta_id,
        Producto: nombre ?? '',
        Cantidad: row.cantidad,
        'Precio unitario': row.precio_unitario,
      })
    }
  }
  const cabecera = ventas.filas.map((row) => {
    const v = row as Record<string, unknown>
    return {
      'N° Venta': v.numero_venta ?? '',
      Fecha: formatoFechaVenta(String(v.fecha ?? '')),
      Cliente: v.cliente_nombre ?? '',
      'Forma de pago': etiquetaFormaPago(String(v.forma_pago ?? '')),
      Cuotas: v.cuotas ?? 1,
      Descuento: v.descuento ?? 0,
      Total: Number(v.total_con_interes ?? v.total_sin_interes ?? 0),
      Seña: v.monto_senia ?? 0,
      'Saldo pendiente': v.saldo_pendiente ?? 0,
      'Estado cobro': v.estado_cobro ?? '',
      Notas: v.notas ?? '',
    }
  })
  await bajarExcel(`ventas_${slugEmpresa(empresa)}_${fechaArchivo()}.xlsx`, [
    { nombre: 'Ventas', filas: cabecera },
    { nombre: 'Items', filas: items },
  ])
}

export async function exportarDatosProductos(client: SupabaseClient, empresa: string) {
  const { filas, error } = await listarProductos(client)
  if (error) throw new Error(error)
  await bajarExcel(`productos_${slugEmpresa(empresa)}_${fechaArchivo()}.xlsx`, [
    {
      nombre: 'Productos',
      filas: filas.map((p) => ({
        Nombre: p.nombre,
        Categoría: p.categoria ?? '',
        Activo: p.activo ? 'Sí' : 'No',
        'Precio venta': p.precio_venta,
        Costo: p.costo,
        Stock: p.stock_actual,
        'Código de barras': p.codigo_barra ?? '',
      })),
    },
  ])
}

export async function exportarDatosCompras(client: SupabaseClient, empresa: string) {
  const compras = await paginar((from, to) =>
    client
      .from('compras')
      .select(
        'id, fecha, proveedor, total, notas, deleted_at, costo_flete, costo_impuestos, costo_otros, total_real, compras_items(producto_nombre, cantidad, costo_unitario, subtotal)',
      )
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .range(from, to),
  )
  if (compras.error) {
    const retry = await paginar((from, to) =>
      client
        .from('compras')
        .select('id, fecha, proveedor, total, notas, deleted_at, compras_items(producto_nombre, cantidad, costo_unitario, subtotal)')
        .is('deleted_at', null)
        .order('fecha', { ascending: false })
        .range(from, to),
    )
    if (retry.error) throw new Error(retry.error)
    compras.filas = retry.filas as typeof compras.filas
  }
  const cabecera: Record<string, unknown>[] = []
  const items: Record<string, unknown>[] = []
  for (const row of compras.filas as Record<string, unknown>[]) {
    cabecera.push({
      Fecha: formatoFechaCompra(String(row.fecha ?? '')),
      Proveedor: row.proveedor ?? '',
      'Subtotal productos': row.total ?? 0,
      Flete: row.costo_flete ?? 0,
      Impuestos: row.costo_impuestos ?? 0,
      Otros: row.costo_otros ?? 0,
      'Total real': row.total_real ?? row.total ?? 0,
      Notas: row.notas ?? '',
    })
    const lineas = Array.isArray(row.compras_items) ? row.compras_items : []
    for (const it of lineas) {
      const i = it as Record<string, unknown>
      items.push({
        Fecha: formatoFechaCompra(String(row.fecha ?? '')),
        Proveedor: row.proveedor ?? '',
        Producto: i.producto_nombre ?? '',
        Cantidad: i.cantidad ?? 0,
        'Costo unitario': i.costo_unitario ?? 0,
        Subtotal: i.subtotal ?? 0,
      })
    }
  }
  await bajarExcel(`compras_${slugEmpresa(empresa)}_${fechaArchivo()}.xlsx`, [
    { nombre: 'Compras', filas: cabecera },
    { nombre: 'Items', filas: items },
  ])
}

export async function exportarDatosClientes(client: SupabaseClient, empresa: string) {
  const { filas, error } = await listarClientes(client)
  if (error) throw new Error(error)
  await bajarExcel(`clientes_${slugEmpresa(empresa)}_${fechaArchivo()}.xlsx`, [
    {
      nombre: 'Clientes',
      filas: filas.map((c) => ({
        Nombre: c.nombre,
        Teléfono: c.telefono ?? '',
        'Última compra': c.ultima_compra ?? '',
        'Cantidad compras': c.cantidad_compras,
        'Total gastado': c.total_gastado,
        Etiquetas: c.etiquetas.join(', '),
      })),
    },
  ])
}

export async function exportarDatosInventario(client: SupabaseClient, empresa: string) {
  const movs = await paginar((from, to) =>
    client
      .from('movimientos_inventario')
      .select(
        'fecha, tipo, cantidad, signo, motivo, costo_unitario, productos(nombre), ubicacion_origen, ubicacion_destino',
      )
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .range(from, to),
  )
  if (movs.error) throw new Error(movs.error)
  await bajarExcel(`inventario_${slugEmpresa(empresa)}_${fechaArchivo()}.xlsx`, [
    {
      nombre: 'Kardex',
      filas: (movs.filas as Record<string, unknown>[]).map((row) => {
        const prod = row.productos as { nombre?: string } | { nombre?: string }[] | null
        const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre
        const estilo = estiloTipoMovimiento(String(row.tipo ?? ''), Number(row.signo ?? 0))
        return {
          Fecha: String(row.fecha ?? ''),
          Producto: nombre ?? '',
          Tipo: estilo.texto,
          Cantidad: row.cantidad ?? 0,
          Signo: row.signo ?? 0,
          Motivo: row.motivo ?? '',
          Costo: row.costo_unitario ?? '',
          Origen: row.ubicacion_origen ?? '',
          Destino: row.ubicacion_destino ?? '',
        }
      }),
    },
  ])
}

export async function exportarDatosGastos(client: SupabaseClient, empresaId: string, empresa: string) {
  const gastos = await paginar((from, to) =>
    client
      .from('gastos')
      .select('fecha, categoria, descripcion, monto, recurrente, frecuencia')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .range(from, to),
  )
  if (gastos.error) throw new Error(gastos.error)
  const labelCat = Object.fromEntries(CATEGORIAS_GASTO.map((c) => [c.id, c.label]))
  await bajarExcel(`gastos_${slugEmpresa(empresa)}_${fechaArchivo()}.xlsx`, [
    {
      nombre: 'Gastos',
      filas: (gastos.filas as Record<string, unknown>[]).map((g) => ({
        Fecha: String(g.fecha ?? '').slice(0, 10),
        Categoría: labelCat[String(g.categoria ?? '')] ?? g.categoria,
        Descripción: g.descripcion ?? '',
        Monto: g.monto ?? 0,
        Recurrente: g.recurrente ? 'Sí' : 'No',
        Frecuencia: g.frecuencia ?? '',
      })),
    },
  ])
}
