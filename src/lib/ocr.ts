import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(
  String(import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || ''),
)

export interface DatosFactura {
  proveedor?: string
  cuit?: string
  fecha?: string
  numero_factura?: string
  items?: Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }>
  subtotal?: number
  iva?: number
  total?: number
  tipo_comprobante?: string
}

export async function procesarFacturaConIA(
  imagenBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<DatosFactura> {
  const key = String(import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '')
  if (!key.trim()) {
    throw new Error('Falta GEMINI_API_KEY')
  }
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
  })

  const prompt = `Analizá esta factura argentina y extraé los datos en formato JSON.
  
Devolvé SOLO un objeto JSON con esta estructura exacta, sin texto adicional:
{
  "proveedor": "nombre del proveedor o razón social",
  "cuit": "XX-XXXXXXXX-X",
  "fecha": "DD/MM/YYYY",
  "numero_factura": "XXXX-XXXXXXXX",
  "tipo_comprobante": "A, B o C",
  "items": [
    {
      "descripcion": "nombre del producto",
      "cantidad": 1,
      "precio_unitario": 1000,
      "subtotal": 1000
    }
  ],
  "subtotal": 0,
  "iva": 0,
  "total": 0
}

Si no podés leer algún campo, poné null.
Todos los montos deben ser números, sin símbolo de pesos.`

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imagenBase64,
        mimeType,
      },
    },
  ])

  const text = result.response.text()
  const jsonStr = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(jsonStr) as DatosFactura
  return normalizarDatosFactura(parsed)
}

export function normalizarDatosFactura(raw: DatosFactura): DatosFactura {
  const items = Array.isArray(raw.items)
    ? raw.items.map((it) => ({
        descripcion: String(it?.descripcion ?? '').trim() || 'Producto',
        cantidad: num(it?.cantidad, 1),
        precio_unitario: num(it?.precio_unitario, 0),
        subtotal: num(it?.subtotal, num(it?.cantidad, 1) * num(it?.precio_unitario, 0)),
      }))
    : []
  return {
    proveedor: txt(raw.proveedor),
    cuit: txt(raw.cuit),
    fecha: txt(raw.fecha),
    numero_factura: txt(raw.numero_factura),
    tipo_comprobante: txt(raw.tipo_comprobante),
    items,
    subtotal: num(raw.subtotal, 0),
    iva: num(raw.iva, 0),
    total: num(raw.total, 0),
  }
}

function txt(v: unknown) {
  if (v == null) return undefined
  const s = String(v).trim()
  if (!s || s === 'null') return undefined
  return s
}

function num(v: unknown, fallback: number) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export function fechaFacturaAIso(valor?: string) {
  const s = (valor ?? '').trim()
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${mm}-${dd}`
  }
  return ''
}

function normalizarTexto(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function distanciaLevenshtein(a: string, b: string) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const prev = new Array(n + 1)
  const curr = new Array(n + 1)
  for (let j = 0; j <= n; j += 1) prev[j] = j
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j]
  }
  return prev[n]
}

export function similitudNombres(a: string, b: string) {
  const x = normalizarTexto(a)
  const y = normalizarTexto(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) {
    const ratio = Math.min(x.length, y.length) / Math.max(x.length, y.length)
    return Math.max(0.71, ratio)
  }
  const dist = distanciaLevenshtein(x, y)
  return 1 - dist / Math.max(x.length, y.length)
}

export function mejorMatchProducto<T extends { id: string; nombre: string }>(
  descripcion: string,
  catalogo: T[],
): { producto: T; score: number } | null {
  let best: { producto: T; score: number } | null = null
  for (const p of catalogo) {
    const score = similitudNombres(descripcion, p.nombre)
    if (!best || score > best.score) best = { producto: p, score }
  }
  if (!best || best.score < 0.7) return null
  return best
}

export async function archivoABase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mimeType = file.type || 'image/jpeg'
  return { base64, mimeType, previewUrl }
}
