import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmarCompra } from './compras'
import {
  ejecutarLoteConRetry,
  esFuncionImportacionFaltante,
  partirEnLotes,
  type ProgresoImportacion,
} from './lotesImportacion'
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

async function resolverItemsCompra(
  client: SupabaseClient,
  mapa: Map<string, { id: string; nombre: string }>,
  fila: FilaImportCompra,
) {
  const items: { producto_id: string; producto_nombre: string; cantidad: number; costo_unitario: number }[] = []
  for (const item of fila.items) {
    const prod = await asegurarProducto(client, mapa, item.nombre, item.costo)
    if ('error' in prod) return { error: prod.error }
    items.push({
      producto_id: prod.id,
      producto_nombre: prod.nombre,
      cantidad: item.cantidad,
      costo_unitario: item.costo,
    })
  }
  return { items }
}

export async function importarCompras(
  client: SupabaseClient,
  filas: FilaImportCompra[],
  productos: { id: string; nombre: string }[],
  onProgreso?: ProgresoImportacion,
): Promise<{ importados: number; errores: ErrorFila[] }> {
  const mapa = new Map(productos.map((p) => [claveNombre(p.nombre), p]))
  const total = filas.length
  const errores: ErrorFila[] = []

  const nuevos: { nombre: string; costo: number }[] = []
  const vistosNuevos = new Set<string>()
  for (const fila of filas) {
    if (fila.error) continue
    for (const item of fila.items) {
      const clave = claveNombre(item.nombre)
      if (mapa.has(clave) || vistosNuevos.has(clave)) continue
      vistosNuevos.add(clave)
      nuevos.push({ nombre: item.nombre, costo: item.costo })
    }
  }
  for (const lote of partirEnLotes(nuevos)) {
    await ejecutarLoteConRetry(() =>
      Promise.all(
        lote.map(async (p) => {
          const creado = await asegurarProducto(client, mapa, p.nombre, p.costo)
          return creado
        }),
      ),
    )
  }
  const pendientes: {
    fila: FilaImportCompra
    items: { producto_id: string; producto_nombre: string; cantidad: number; costo_unitario: number }[]
  }[] = []

  for (const fila of filas) {
    if (fila.error) {
      errores.push({ fila: fila.filaExcel, motivo: fila.error })
      continue
    }
    const res = await resolverItemsCompra(client, mapa, fila)
    if ('error' in res) {
      errores.push({ fila: fila.filaExcel, motivo: res.error ?? 'No se pudo resolver el producto' })
      continue
    }
    pendientes.push({ fila, items: res.items })
  }

  onProgreso?.(errores.length, total)

  let importados = 0
  let hechos = errores.length
  let usarLoteRpc = true

  for (const lote of partirEnLotes(pendientes)) {
    if (usarLoteRpc) {
      try {
        const data = await ejecutarLoteConRetry(async () => {
          const res = await client.rpc('importar_compras_lote', {
            p_compras: lote.map((v) => ({
              fila: v.fila.filaExcel,
              items: v.items,
              proveedor: v.fila.proveedor,
              fecha: v.fila.fecha,
              notas: v.fila.notas,
              proveedor_id: null,
            })),
          })
          if (res.error) throw res.error
          return res.data
        })
        const row = (data ?? {}) as { importados?: number; errores?: { fila?: number; motivo?: string }[] }
        importados += Number(row.importados ?? 0)
        for (const err of row.errores ?? []) {
          errores.push({ fila: Number(err.fila ?? 0), motivo: String(err.motivo ?? 'Error') })
        }
      } catch (error) {
        if (!esFuncionImportacionFaltante(error)) {
          const motivo = error instanceof Error ? error.message : String(error)
          for (const v of lote) errores.push({ fila: v.fila.filaExcel, motivo })
        } else {
          usarLoteRpc = false
        }
      }
    }
    if (!usarLoteRpc) {
      const resultados = await ejecutarLoteConRetry(() =>
        Promise.allSettled(
          lote.map((v) =>
            confirmarCompra(client, {
              items: v.items,
              proveedor: v.fila.proveedor,
              fecha: v.fila.fecha,
              notas: v.fila.notas,
            }),
          ),
        ),
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
            : r.reason instanceof Error
              ? r.reason.message
              : String(r.reason)
        errores.push({ fila: item.fila.filaExcel, motivo })
      })
    }
    hechos += lote.length
    onProgreso?.(hechos, total)
  }

  return { importados, errores }
}

export function etiquetaPreviewCompra(fila: FilaImportCompra) {
  return fila.fecha ? formatoFechaCorta(fila.fecha) : '—'
}
