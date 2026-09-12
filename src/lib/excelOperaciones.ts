import Papa from 'papaparse'

export function claveNombre(nombre: string) {
  return nombre.trim().toLowerCase()
}

export function numeroCelda(v: unknown) {
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

export function enteroCelda(v: unknown) {
  return Math.max(0, Math.trunc(numeroCelda(v)))
}

export function textoCelda(v: unknown) {
  return String(v ?? '').trim()
}

export function celdaEsNumero(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return true
  const s = textoCelda(v)
  if (!s) return false
  return /^-?\d+([.,]\d+)?$/.test(s.replace(/\s/g, '').replace(/\$/g, ''))
}

export function claveColumna(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export async function leerMatrizExcel(file: File): Promise<unknown[][]> {
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith('.csv')) {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
    return (parsed.data ?? []).map((row) => (Array.isArray(row) ? row : []))
  }
  const buf = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const hoja = wb.Sheets[wb.SheetNames[0] ?? '']
  if (!hoja) return []
  return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true }) as unknown[][]
}

export async function descargarPlantilla(nombreArchivo: string, hoja: string, filas: unknown[][]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(filas)
  XLSX.utils.book_append_sheet(wb, ws, hoja)
  XLSX.writeFile(wb, nombreArchivo)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Devuelve YYYY-MM-DD o null. */
export function parseFechaCelda(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = v.getMonth() + 1
    const d = v.getDate()
    return `${y}-${pad2(m)}-${pad2(d)}`
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const utc = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(utc)
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    }
  }
  const s = textoCelda(v)
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`
  }
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    let y = Number(dmy[3])
    if (y < 100) y += 2000
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${pad2(month)}-${pad2(day)}`
  }
  return null
}

export function fechaATimestamptzAR(isoDate: string) {
  return `${isoDate}T12:00:00.000-03:00`
}

export function formatoFechaCorta(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return `${pad2(d)}/${pad2(m)}/${y}`
}

export type ErrorFila = { fila: number; motivo: string }
