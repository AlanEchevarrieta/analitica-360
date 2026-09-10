import type { SupabaseClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import { crearProducto, type ProductoFila } from './productos'
import {
  ejecutarLoteConRetry,
  esFuncionImportacionFaltante,
  partirEnLotes,
  type ProgresoImportacion,
} from './lotesImportacion'

export const COLUMNAS_PLANTILLA = [
  'Nombre',
  'Categoría',
  'Precio de venta',
  'Costo',
  'Stock inicial',
] as const

export type FilaImportacion = {
  nombre: string
  categoria: string
  precioVenta: number
  costo: number
  stockInicial: number
}

function claveNombre(nombre: string) {
  return nombre.trim().toLowerCase()
}

function numeroCelda(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  let s = String(v ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\$/g, '')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function enteroCelda(v: unknown) {
  return Math.max(0, Math.trunc(numeroCelda(v)))
}

function textoCelda(v: unknown) {
  return String(v ?? '').trim()
}

function claveColumna(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function mapaColumnas(headers: string[]) {
  const idx: Record<string, number> = {}
  headers.forEach((h, i) => {
    const k = claveColumna(h)
    if (k === 'nombre') idx.nombre = i
    if (k === 'categoria') idx.categoria = i
    if (k.includes('precio')) idx.precio = i
    if (k === 'costo') idx.costo = i
    if (k.includes('stock')) idx.stock = i
  })
  return idx
}

function filasDesdeMatriz(rows: unknown[][]): FilaImportacion[] {
  if (rows.length === 0) return []
  const headers = (rows[0] ?? []).map((h) => textoCelda(h))
  const idx = mapaColumnas(headers)
  const nombreIdx = idx.nombre ?? 0
  const out: FilaImportacion[] = []
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) continue
    const nombre = textoCelda(row[nombreIdx])
    if (!nombre) continue
    out.push({
      nombre,
      categoria: textoCelda(row[idx.categoria ?? 1]),
      precioVenta: numeroCelda(row[idx.precio ?? 2]),
      costo: numeroCelda(row[idx.costo ?? 3]),
      stockInicial: enteroCelda(row[idx.stock ?? 4]),
    })
  }
  return out
}

export async function descargarPlantillaProductos() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    [...COLUMNAS_PLANTILLA],
    ['Remera básica', 'Indumentaria', 15000, 8000, 10],
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  XLSX.writeFile(wb, 'plantilla_productos.xlsx')
}

export async function leerArchivoProductos(file: File): Promise<FilaImportacion[]> {
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith('.csv')) {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
    const rows = (parsed.data ?? []).map((row) => (Array.isArray(row) ? row : []))
    return filasDesdeMatriz(rows)
  }
  const buf = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array' })
  const hoja = wb.Sheets[wb.SheetNames[0] ?? '']
  if (!hoja) return []
  const rows = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' }) as unknown[][]
  return filasDesdeMatriz(rows)
}

export async function importarProductos(
  client: SupabaseClient,
  filas: FilaImportacion[],
  existentes: ProductoFila[],
  onProgreso?: ProgresoImportacion,
): Promise<{ importados: number; saltados: string[] }> {
  const vistos = new Set(existentes.map((p) => claveNombre(p.nombre)))
  const saltados: string[] = []
  const pendientes: FilaImportacion[] = []
  for (const fila of filas) {
    const clave = claveNombre(fila.nombre)
    if (vistos.has(clave)) {
      saltados.push(fila.nombre)
      continue
    }
    vistos.add(clave)
    pendientes.push(fila)
  }

  const total = filas.length
  let importados = 0
  let hechos = saltados.length
  onProgreso?.(hechos, total)
  let usarLoteRpc = true

  for (const lote of partirEnLotes(pendientes)) {
    if (usarLoteRpc) {
      try {
        const data = await ejecutarLoteConRetry(async () => {
          const res = await client.rpc('crear_productos_lote', {
            p_productos: lote.map((fila) => ({
              nombre: fila.nombre,
              categoria: fila.categoria,
              precio_venta: fila.precioVenta,
              costo: fila.costo,
              stock_inicial: fila.stockInicial,
              activo: true,
            })),
          })
          if (res.error) throw res.error
          return res.data
        })
        const row = (data ?? {}) as { importados?: number; saltados?: string[] }
        importados += Number(row.importados ?? 0)
        saltados.push(...(row.saltados ?? []))
      } catch (error) {
        if (!esFuncionImportacionFaltante(error)) {
          for (const fila of lote) saltados.push(`${fila.nombre} (${error instanceof Error ? error.message : 'Error'})`)
        } else {
          usarLoteRpc = false
        }
      }
    }
    if (!usarLoteRpc) {
      const resultados = await ejecutarLoteConRetry(() =>
        Promise.allSettled(
          lote.map((fila) =>
            crearProducto(client, {
              nombre: fila.nombre,
              categoria: fila.categoria,
              precioVenta: fila.precioVenta,
              costo: fila.costo,
              stockInicial: fila.stockInicial,
              activo: true,
            }),
          ),
        ),
      )
      resultados.forEach((r, i) => {
        const fila = lote[i]
        if (!fila) return
        if (r.status === 'fulfilled' && !r.value.error) {
          importados += 1
          return
        }
        const motivo =
          r.status === 'fulfilled'
            ? r.value.error ?? 'Error'
            : r.reason instanceof Error
              ? r.reason.message
              : String(r.reason)
        saltados.push(`${fila.nombre} (${motivo})`)
      })
    }
    hechos += lote.length
    onProgreso?.(hechos, total)
  }

  return { importados, saltados }
}
