import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmarCompra } from './compras'
import {
  claveNombre,
  descargarPlantilla,
  enteroCelda,
  formatoFechaCorta,
  leerMatrizExcel,
  numeroCelda,
  parseFechaCelda,
  textoCelda,
  type ErrorFila,
} from './excelOperaciones'

export const COLUMNAS_PLANTILLA_COMPRAS = [
  'Fecha',
  'Proveedor',
  'Producto 1',
  'Cantidad 1',
  'Costo unitario 1',
  'Producto 2',
  'Cantidad 2',
  'Costo unitario 2',
  'Producto 3',
  'Cantidad 3',
  'Costo unitario 3',
  'Notas',
] as const

export type ItemImportCompra = {
  nombre: string
  cantidad: number
  costo: number
  productoId?: string
}

export type FilaImportCompra = {
  filaExcel: number
  fecha: string
  proveedor: string
  items: ItemImportCompra[]
  notas: string
  error: string | null
  resumen: string
}

function itemsDesdeRow(row: unknown[], offset: number) {
  const items: ItemImportCompra[] = []
  for (let i = 0; i < 3; i++) {
    const base = offset + i * 3
    const nombre = textoCelda(row[base])
    const cantidad = enteroCelda(row[base + 1])
    const costo = numeroCelda(row[base + 2])
    if (!nombre && cantidad === 0 && costo === 0) continue
    items.push({ nombre, cantidad, costo })
  }
  return items
}

function filasDesdeMatriz(rows: unknown[][]): FilaImportCompra[] {
  if (rows.length === 0) return []
  const first = (rows[0] ?? []).map((h) => textoCelda(h))
  const header = textoCelda(first[0]).toLowerCase().includes('fecha')
  const data = header ? rows.slice(1) : rows
  const startExcel = header ? 2 : 1
  const out: FilaImportCompra[] = []

  data.forEach((row, i) => {
    if (!Array.isArray(row)) return
    const filaExcel = startExcel + i
    const fecha = parseFechaCelda(row[0])
    const proveedor = textoCelda(row[1])
    const items = itemsDesdeRow(row, 2)
    const notas = textoCelda(row[11])
    const vacia = !fecha && !proveedor && items.length === 0
    if (vacia) return

    let error: string | null = null
    if (!fecha) error = 'Fecha inválida (usá DD/MM/YYYY)'
    else if (items.length === 0) error = 'Falta al menos un producto'
    else if (items.some((it) => !it.nombre)) error = 'Hay un producto sin nombre'
    else if (items.some((it) => it.cantidad <= 0)) error = 'La cantidad tiene que ser un entero mayor a 0'
    else if (items.some((it) => it.costo < 0)) error = 'El costo unitario no puede ser negativo'

    out.push({
      filaExcel,
      fecha: fecha ?? '',
      proveedor,
      items,
      notas,
      error,
      resumen: items.map((it) => `${it.nombre} × ${it.cantidad}`).join(', '),
    })
  })
  return out
}

export async function descargarPlantillaCompras() {
  await descargarPlantilla('plantilla_compras.xlsx', 'Compras', [
    [...COLUMNAS_PLANTILLA_COMPRAS],
    ['15/03/2024', 'Proveedor SA', 'Remera básica', 10, 8000, '', '', '', '', '', '', ''],
  ])
}

export async function leerArchivoCompras(file: File): Promise<FilaImportCompra[]> {
  const rows = await leerMatrizExcel(file)
  return filasDesdeMatriz(rows)
}

async function asegurarProducto(
  client: SupabaseClient,
  mapa: Map<string, { id: string; nombre: string }>,
  nombre: string,
  costo: number,
): Promise<{ id: string; nombre: string } | { error: string }> {
  const clave = claveNombre(nombre)
  const existente = mapa.get(clave)
  if (existente) return existente

  const { data, error } = await client.rpc('crear_producto', {
    p_nombre: nombre,
    p_categoria: '',
    p_precio_venta: costo,
    p_costo: costo,
    p_stock_inicial: 0,
    p_activo: true,
  })
  if (error || !data) {
    return { error: error?.message ?? `No se pudo crear el producto ${nombre}` }
  }
  const creado = { id: String(data), nombre }
  mapa.set(clave, creado)
  return creado
}

export async function importarCompras(
  client: SupabaseClient,
  filas: FilaImportCompra[],
  productos: { id: string; nombre: string }[],
): Promise<{ importados: number; errores: ErrorFila[] }> {
  const mapa = new Map(productos.map((p) => [claveNombre(p.nombre), p]))
  let importados = 0
  const errores: ErrorFila[] = []

  for (const fila of filas) {
    if (fila.error) {
      errores.push({ fila: fila.filaExcel, motivo: fila.error })
      continue
    }

    const items: { producto_id: string; producto_nombre: string; cantidad: number; costo_unitario: number }[] = []
    let falloItem: string | null = null
    for (const item of fila.items) {
      const prod = await asegurarProducto(client, mapa, item.nombre, item.costo)
      if ('error' in prod) {
        falloItem = prod.error
        break
      }
      items.push({
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        cantidad: item.cantidad,
        costo_unitario: item.costo,
      })
    }
    if (falloItem) {
      errores.push({ fila: fila.filaExcel, motivo: falloItem })
      continue
    }

    const fallo = await confirmarCompra(client, {
      items,
      proveedor: fila.proveedor,
      fecha: fila.fecha,
      notas: fila.notas,
    })
    if (fallo) {
      errores.push({ fila: fila.filaExcel, motivo: fallo })
      continue
    }
    importados += 1
  }

  return { importados, errores }
}

export function etiquetaPreviewCompra(fila: FilaImportCompra) {
  return fila.fecha ? formatoFechaCorta(fila.fecha) : '—'
}
