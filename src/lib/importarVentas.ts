import type { SupabaseClient } from '@supabase/supabase-js'
import { crearCliente } from './clientes'
import {
  ejecutarLoteConRetry,
  esFuncionImportacionFaltante,
  partirEnLotes,
  type ProgresoImportacion,
} from './lotesImportacion'
import {
  celdaEsNumero,
  claveColumna,
  claveNombre,
  descargarPlantilla,
  enteroCelda,
  fechaATimestamptzAR,
  formatoFechaCorta,
  leerMatrizExcel,
  numeroCelda,
  parseFechaCelda,
  textoCelda,
  type ErrorFila,
} from './excelOperaciones'
import { FORMAS_PAGO } from './ventas'
import { avisoVarianteFaltante, buscarVariantePorTexto, listarVariantesDeProductos, type VarianteFila } from './variantes'

export const COLUMNAS_PLANTILLA_VENTAS = [
  'Fecha',
  'Producto 1',
  'Variante 1',
  'Cantidad 1',
  'Precio unitario 1',
  'Producto 2',
  'Variante 2',
  'Cantidad 2',
  'Precio unitario 2',
  'Producto 3',
  'Variante 3',
  'Cantidad 3',
  'Precio unitario 3',
  'Producto 4',
  'Variante 4',
  'Cantidad 4',
  'Precio unitario 4',
  'Producto 5',
  'Variante 5',
  'Cantidad 5',
  'Precio unitario 5',
  'Forma de pago',
  'Cliente',
  'Descuento en ARS',
  'Notas',
] as const

const PRODUCTOS_POR_FILA = 5

export type ItemImportVenta = {
  nombre: string
  variante: string
  cantidad: number
  precio: number
  productoId?: string
  varianteId?: string | null
  avisoVariante?: string | null
}

export type FilaImportVenta = {
  filaExcel: number
  fecha: string
  items: ItemImportVenta[]
  formaPago: string
  formaLabel: string
  cliente: string
  descuento: number
  notas: string
  error: string | null
  advertencias: string[]
  resumen: string
}

function resumenItem(it: ItemImportVenta) {
  return it.variante ? `${it.nombre} (${it.variante}) × ${it.cantidad}` : `${it.nombre} × ${it.cantidad}`
}

function mapearFormaPago(raw: string): { id: string; label: string } | null {
  const k = claveColumna(raw)
  if (!k) return null
  if (k === 'efectivo') return { id: 'efectivo', label: 'Efectivo' }
  if (k === 'transferencia') return { id: 'transferencia', label: 'Transferencia' }
  if (k === 'debito' || k === 'debito automatico') return { id: 'debito', label: 'Débito' }
  if (k === 'credito' || k === 'tarjeta de credito') return { id: 'credito', label: 'Crédito' }
  if (k.includes('qr') || k.includes('mercado pago') || k === 'mp') {
    return { id: 'qr', label: 'Mercado Pago QR' }
  }
  const known = FORMAS_PAGO.find((f) => claveColumna(f.label) === k || f.id === k)
  return known ? { id: known.id, label: known.label } : null
}

function layoutVentas(row: unknown[], encabezado: string[]) {
  const keys = encabezado.map((h) => claveColumna(h))
  const formaHeader = keys.findIndex((k) => k.includes('forma') && k.includes('pago'))
  const conVarianteHeader = keys.some((k) => k.includes('variante'))
  if (formaHeader > 0) {
    const stride = conVarianteHeader ? 4 : 3
    return { offset: 1, stride, colPago: formaHeader }
  }
  for (const idx of [21, 16, 13, 10, 9, 5, 4]) {
    if (!mapearFormaPago(textoCelda(row[idx]))) continue
    const cols = idx - 1
    if (cols > 0 && cols % 4 === 0) return { offset: 1, stride: 4, colPago: idx }
    if (cols > 0 && cols % 3 === 0) return { offset: 1, stride: 3, colPago: idx }
  }
  const stride = celdaEsNumero(row[2]) ? 3 : 4
  return { offset: 1, stride, colPago: 1 + PRODUCTOS_POR_FILA * stride }
}

function itemsDesdeRow(row: unknown[], offset: number, cantidad: number, stride: number) {
  const items: ItemImportVenta[] = []
  for (let i = 0; i < cantidad; i++) {
    const base = offset + i * stride
    const nombre = textoCelda(row[base])
    const variante = stride === 4 ? textoCelda(row[base + 1]) : ''
    const cantidadItem = enteroCelda(row[base + (stride === 4 ? 2 : 1)])
    const precio = numeroCelda(row[base + (stride === 4 ? 3 : 2)])
    if (!nombre && !variante && cantidadItem === 0 && precio === 0) continue
    items.push({ nombre, variante, cantidad: cantidadItem, precio })
  }
  return items
}

function filasDesdeMatriz(rows: unknown[][]): FilaImportVenta[] {
  if (rows.length === 0) return []
  const first = (rows[0] ?? []).map((h) => textoCelda(h))
  const header = claveColumna(first[0] ?? '').includes('fecha')
  const encabezado = header ? first : []
  const data = header ? rows.slice(1) : rows
  const startExcel = header ? 2 : 1
  const out: FilaImportVenta[] = []

  data.forEach((row, i) => {
    if (!Array.isArray(row)) return
    const filaExcel = startExcel + i
    const layout = layoutVentas(row, encabezado)
    const nProductos = Math.max(1, Math.floor((layout.colPago - layout.offset) / layout.stride))
    const fecha = parseFechaCelda(row[0])
    const items = itemsDesdeRow(row, layout.offset, nProductos, layout.stride)
    const forma = mapearFormaPago(textoCelda(row[layout.colPago]))
    const cliente = textoCelda(row[layout.colPago + 1])
    const descuento = numeroCelda(row[layout.colPago + 2])
    const notas = textoCelda(row[layout.colPago + 3])
    const vacia = !fecha && items.length === 0 && !forma && !cliente
    if (vacia) return

    let error: string | null = null
    if (!fecha) error = 'Fecha inválida (usá DD/MM/YYYY)'
    else if (items.length === 0) error = 'Falta al menos un producto'
    else if (items.some((it) => !it.nombre)) error = 'Hay un producto sin nombre'
    else if (items.some((it) => it.cantidad <= 0)) error = 'La cantidad tiene que ser un entero mayor a 0'
    else if (items.some((it) => it.precio < 0)) error = 'El precio unitario no puede ser negativo'
    else if (!forma) error = 'Forma de pago inválida'

    out.push({
      filaExcel,
      fecha: fecha ?? '',
      items,
      formaPago: forma?.id ?? '',
      formaLabel: forma?.label ?? textoCelda(row[layout.colPago]) ?? '',
      cliente,
      descuento: descuento < 0 ? 0 : descuento,
      notas,
      error,
      advertencias: [],
      resumen: items.map(resumenItem).join(', '),
    })
  })
  return out
}

function vaciosProductos(n: number) {
  return Array.from({ length: n }, () => '')
}

export async function descargarPlantillaVentas() {
  await descargarPlantilla('plantilla_ventas.xlsx', 'Ventas', [
    [...COLUMNAS_PLANTILLA_VENTAS],
    [
      '01/01/2026',
      'Bolso Matero',
      'Negro/Ecocuero',
      2,
      49000,
      ...vaciosProductos(16),
      'Transferencia',
      '',
      0,
      '',
    ],
  ])
}

export async function leerArchivoVentas(file: File): Promise<FilaImportVenta[]> {
  const rows = await leerMatrizExcel(file)
  return filasDesdeMatriz(rows)
}

export function aplicarCatalogoVentas(
  filas: FilaImportVenta[],
  productos: { id: string; nombre: string }[],
  variantes: VarianteFila[] = [],
): FilaImportVenta[] {
  const mapa = new Map(productos.map((p) => [claveNombre(p.nombre), p]))
  return filas.map((fila) => {
    if (fila.error) return fila
    const resueltos: ItemImportVenta[] = []
    const advertencias: string[] = []
    for (const item of fila.items) {
      const prod = mapa.get(claveNombre(item.nombre))
      if (!prod) {
        return { ...fila, error: `Producto no encontrado: ${item.nombre}`, advertencias: [] }
      }
      let varianteId: string | null = null
      let avisoVariante: string | null = null
      if (item.variante) {
        const hit = buscarVariantePorTexto(variantes, prod.id, item.variante)
        if (hit) varianteId = hit.id
        else {
          avisoVariante = avisoVarianteFaltante(item.nombre, item.variante)
          advertencias.push(avisoVariante)
        }
      }
      resueltos.push({ ...item, productoId: prod.id, varianteId, avisoVariante })
    }
    return { ...fila, items: resueltos, advertencias, resumen: resueltos.map(resumenItem).join(', ') }
  })
}

function motivoErrorVenta(msg: string) {
  const t = msg.toLowerCase()
  if (t.includes('could not find the function') || t.includes('schema cache') || t.includes('pgrst202')) {
    return 'Falta correr supabase/021_importar_ventas.sql, supabase/041_importar_lotes.sql y supabase/045_importar_venta_variante.sql en el SQL Editor (rol postgres).'
  }
  return msg
}

function payloadVenta(fila: FilaImportVenta, clienteId: string | null) {
  return {
    fila: fila.filaExcel,
    items: fila.items.map((it) => ({
      producto_id: it.productoId,
      cantidad: it.cantidad,
      precio_unitario: it.precio,
      variante_id: it.varianteId ?? null,
    })),
    forma_pago: fila.formaPago,
    descuento: fila.descuento,
    cliente: fila.cliente,
    cliente_id: clienteId,
    fecha: fechaATimestamptzAR(fila.fecha),
    notas: fila.notas,
  }
}

async function importarUnaVenta(
  client: SupabaseClient,
  fila: FilaImportVenta,
  clienteId: string | null,
): Promise<string | null> {
  const { error } = await client.rpc('importar_venta', {
    p_items: payloadVenta(fila, clienteId).items,
    p_forma_pago: fila.formaPago,
    p_descuento: fila.descuento,
    p_cliente: fila.cliente,
    p_cliente_id: clienteId,
    p_fecha: fechaATimestamptzAR(fila.fecha),
    p_notas: fila.notas,
  })
  return error ? motivoErrorVenta(error.message) : null
}

export async function importarVentas(
  client: SupabaseClient,
  filas: FilaImportVenta[],
  productos: { id: string; nombre: string }[],
  onProgreso?: ProgresoImportacion,
): Promise<{ importados: number; errores: ErrorFila[] }> {
  const vars = await listarVariantesDeProductos(
    client,
    productos.map((p) => p.id),
  )
  const preparadas = aplicarCatalogoVentas(filas, productos, vars.filas)
  const total = preparadas.length
  const clientesRes = await client.from('clientes').select('id, nombre').is('deleted_at', null)
  const clientes = new Map<string, string>()
  if (!clientesRes.error) {
    for (const row of clientesRes.data ?? []) {
      clientes.set(claveNombre(String(row.nombre)), String(row.id))
    }
  }

  const errores: ErrorFila[] = []
  const validas: { fila: FilaImportVenta; clienteId: string | null }[] = []
  const nombresNuevos: string[] = []
  const vistosNuevos = new Set<string>()

  for (const fila of preparadas) {
    if (fila.error) {
      errores.push({ fila: fila.filaExcel, motivo: fila.error })
      continue
    }
    if (!fila.cliente) {
      validas.push({ fila, clienteId: null })
      continue
    }
    const clave = claveNombre(fila.cliente)
    const existente = clientes.get(clave)
    if (existente) {
      validas.push({ fila, clienteId: existente })
      continue
    }
    if (!vistosNuevos.has(clave)) {
      vistosNuevos.add(clave)
      nombresNuevos.push(fila.cliente)
    }
    validas.push({ fila, clienteId: null })
  }

  onProgreso?.(errores.length, total)

  for (const lote of partirEnLotes(nombresNuevos)) {
    await ejecutarLoteConRetry(async () => {
      const res = await Promise.all(
        lote.map((nombre) =>
          crearCliente(client, {
            nombre,
            telefono: '',
            email: '',
            cumpleanos: null,
            notasLibres: '',
            etiquetas: ['Nuevo'],
          }),
        ),
      )
      res.forEach((creado, i) => {
        const nombre = lote[i]
        if (creado.id && nombre) clientes.set(claveNombre(nombre), creado.id)
      })
    })
  }

  const pendientes = validas.map((v) => ({
    fila: v.fila,
    clienteId: v.clienteId ?? (v.fila.cliente ? clientes.get(claveNombre(v.fila.cliente)) ?? null : null),
  }))

  let importados = 0
  let hechos = errores.length
  let usarLoteRpc = true

  for (const lote of partirEnLotes(pendientes)) {
    if (usarLoteRpc) {
      try {
        const data = await ejecutarLoteConRetry(async () => {
          const res = await client.rpc('importar_ventas_lote', {
            p_ventas: lote.map((v) => payloadVenta(v.fila, v.clienteId)),
          })
          if (res.error) throw res.error
          return res.data
        })
        const row = (data ?? {}) as { importados?: number; errores?: { fila?: number; motivo?: string }[] }
        importados += Number(row.importados ?? 0)
        for (const err of row.errores ?? []) {
          errores.push({ fila: Number(err.fila ?? 0), motivo: motivoErrorVenta(String(err.motivo ?? 'Error')) })
        }
      } catch (error) {
        if (!esFuncionImportacionFaltante(error)) {
          const motivo = motivoErrorVenta(error instanceof Error ? error.message : String(error))
          for (const v of lote) errores.push({ fila: v.fila.filaExcel, motivo })
        } else {
          usarLoteRpc = false
        }
      }
    }
    if (!usarLoteRpc) {
      const resultados = await ejecutarLoteConRetry(() =>
        Promise.allSettled(lote.map((v) => importarUnaVenta(client, v.fila, v.clienteId))),
      )
      resultados.forEach((r, i) => {
        const item = lote[i]
        if (!item) return
        if (r.status === 'fulfilled' && !r.value) {
          importados += 1
          return
        }
        const motivo =
          r.status === 'fulfilled'
            ? r.value ?? 'Error'
            : motivoErrorVenta(r.reason instanceof Error ? r.reason.message : String(r.reason))
        errores.push({ fila: item.fila.filaExcel, motivo })
      })
    }
    hechos += lote.length
    onProgreso?.(hechos, total)
  }

  return { importados, errores }
}

export function etiquetaPreviewVenta(fila: FilaImportVenta) {
  return fila.fecha ? formatoFechaCorta(fila.fecha) : '—'
}

export function etiquetaPreviewVariantes(fila: { items: { variante?: string }[] }) {
  const textos = fila.items.map((it) => it.variante?.trim() || '—')
  return textos.length ? textos.join(', ') : '—'
}
