import { formatoARS, type ProductoFila } from './productos'
import { precioVarianteOBase, type VarianteFila } from './variantes'

export type TamanoEtiqueta = 'pequena' | 'mediana' | 'grande'

export type CampoEtiqueta =
  | 'mostrarPrecio'
  | 'mostrarNombre'
  | 'mostrarVariante'
  | 'mostrarBarras'
  | 'mostrarQr'
  | 'mostrarUrl'

export type OpcionesEtiqueta = Record<CampoEtiqueta, boolean> & {
  tamano: TamanoEtiqueta
}

export type EtiquetaImpresion = {
  nombre: string
  variante: string | null
  precio: string
  precioNumero: number
  codigo: string
}

export const OPCIONES_ETIQUETA_DEFAULT: OpcionesEtiqueta = {
  mostrarPrecio: true,
  mostrarNombre: true,
  mostrarVariante: true,
  mostrarBarras: true,
  mostrarQr: true,
  mostrarUrl: false,
  tamano: 'mediana',
}

const STORAGE_OPCIONES = 'analitica.etiqueta.opciones'

const CAMPOS: CampoEtiqueta[] = [
  'mostrarPrecio',
  'mostrarNombre',
  'mostrarVariante',
  'mostrarBarras',
  'mostrarQr',
  'mostrarUrl',
]

const DISPONIBLES: Record<TamanoEtiqueta, ReadonlySet<CampoEtiqueta>> = {
  pequena: new Set(['mostrarNombre', 'mostrarBarras']),
  mediana: new Set(['mostrarNombre', 'mostrarVariante', 'mostrarPrecio', 'mostrarBarras', 'mostrarQr']),
  grande: new Set(['mostrarNombre', 'mostrarVariante', 'mostrarPrecio', 'mostrarBarras', 'mostrarQr', 'mostrarUrl']),
}

const FIJOS: Record<TamanoEtiqueta, ReadonlySet<CampoEtiqueta>> = {
  pequena: new Set(['mostrarNombre', 'mostrarBarras']),
  mediana: new Set(['mostrarNombre', 'mostrarVariante', 'mostrarBarras']),
  grande: new Set([
    'mostrarNombre',
    'mostrarVariante',
    'mostrarPrecio',
    'mostrarBarras',
    'mostrarQr',
    'mostrarUrl',
  ]),
}

export function campoDisponibleEnTamano(tamano: TamanoEtiqueta, campo: CampoEtiqueta) {
  return DISPONIBLES[tamano].has(campo)
}

export function campoFijoEnTamano(tamano: TamanoEtiqueta, campo: CampoEtiqueta) {
  return FIJOS[tamano].has(campo)
}

export function tooltipCampoEtiqueta(tamano: TamanoEtiqueta, campo: CampoEtiqueta) {
  if (campoDisponibleEnTamano(tamano, campo)) return undefined
  if (tamano === 'pequena') return 'No disponible en tamaño pequeño'
  if (tamano === 'mediana') return 'No disponible en tamaño mediano'
  return 'No disponible en este tamaño'
}

export function aplicarCamposPorTamano(op: OpcionesEtiqueta): OpcionesEtiqueta {
  const next = { ...op }
  for (const campo of CAMPOS) {
    if (campoFijoEnTamano(op.tamano, campo)) next[campo] = true
    else if (!campoDisponibleEnTamano(op.tamano, campo)) next[campo] = false
  }
  return next
}

function truncarTexto(texto: string, max: number) {
  const t = texto.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(1, max - 1))}…`
}

function textoVisible(e: EtiquetaImpresion, op: OpcionesEtiqueta) {
  if (op.tamano === 'pequena') {
    return { nombre: truncarTexto(e.nombre, 20), variante: null as string | null }
  }
  if (op.tamano === 'mediana') {
    return {
      nombre: truncarTexto(e.nombre, 25),
      variante: e.variante ? truncarTexto(e.variante, 20) : null,
    }
  }
  return { nombre: e.nombre, variante: e.variante }
}

const TAMANO_CSS: Record<
  TamanoEtiqueta,
  { w: string; h: string; cols: number; qr: string; barraH: string; qrPx: number }
> = {
  pequena: { w: '4cm', h: '2.5cm', cols: 4, qr: '1.4cm', barraH: '8mm', qrPx: 56 },
  mediana: { w: '6cm', h: '4cm', cols: 3, qr: '2.2cm', barraH: '10mm', qrPx: 80 },
  grande: { w: '9cm', h: '6cm', cols: 2, qr: '3cm', barraH: '14mm', qrPx: 114 },
}

export const calcularEAN13 = (codigo12: string): string => {
  const digits = codigo12.split('').map(Number)
  const sum = digits.reduce((acc, digit, index) => {
    return acc + digit * (index % 2 === 0 ? 1 : 3)
  }, 0)
  const checkDigit = (10 - (sum % 10)) % 10
  return codigo12 + checkDigit
}

export function doceDigitosDesdeId(id: string): string {
  const mapped = [...id.replace(/-/g, '').toLowerCase()]
    .map((ch) => {
      if (ch >= '0' && ch <= '9') return ch
      if (ch >= 'a' && ch <= 'z') return String((ch.charCodeAt(0) - 97) % 10)
      return ''
    })
    .join('')
  return mapped.slice(-12).padStart(12, '0')
}

export function ean13DesdeEntidad(id: string): string {
  return calcularEAN13(doceDigitosDesdeId(id))
}

export function etiquetaAtributosLarga(atributos: Record<string, string>) {
  return Object.keys(atributos)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((k) => {
      const val = atributos[k]?.trim()
      if (!val) return ''
      return `${k}: ${val}`
    })
    .filter(Boolean)
    .join(' | ')
}

export function leerOpcionesEtiqueta(): OpcionesEtiqueta {
  try {
    const raw = localStorage.getItem(STORAGE_OPCIONES)
    if (!raw) return { ...OPCIONES_ETIQUETA_DEFAULT }
    const parsed = JSON.parse(raw) as Partial<OpcionesEtiqueta>
    const tamano: TamanoEtiqueta =
      parsed.tamano === 'pequena' || parsed.tamano === 'grande' ? parsed.tamano : 'mediana'
    return aplicarCamposPorTamano({
      mostrarPrecio: parsed.mostrarPrecio !== false,
      mostrarNombre: parsed.mostrarNombre !== false,
      mostrarVariante: parsed.mostrarVariante !== false,
      mostrarBarras: parsed.mostrarBarras !== false,
      mostrarQr: parsed.mostrarQr !== false,
      mostrarUrl: parsed.mostrarUrl === true,
      tamano,
    })
  } catch {
    return { ...OPCIONES_ETIQUETA_DEFAULT }
  }
}

export function guardarOpcionesEtiqueta(op: OpcionesEtiqueta) {
  localStorage.setItem(STORAGE_OPCIONES, JSON.stringify(op))
}

async function jsBarcodeFn() {
  const mod = await import('jsbarcode')
  return mod.default
}

export async function svgCodigoBarras(valor: string, opts?: { mostrarNumero?: boolean; alto?: number }) {
  const JsBarcode = await jsBarcodeFn()
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, valor, {
    format: 'CODE128',
    width: 1.5,
    height: opts?.alto ?? 40,
    displayValue: Boolean(opts?.mostrarNumero),
    fontSize: 12,
    margin: 2,
    background: '#ffffff',
    lineColor: '#1A2F4A',
    font: 'Inter, system-ui, sans-serif',
  })
  return svg.outerHTML
}

async function qrDataUrl(texto: string, width: number) {
  const QRCode = await import('qrcode')
  return QRCode.toDataURL(texto, {
    width,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

function textoQr(e: EtiquetaImpresion, op: OpcionesEtiqueta) {
  const nombre =
    e.variante && op.mostrarVariante ? `${e.nombre} ${e.variante}` : e.nombre
  const precio = Number.isInteger(e.precioNumero)
    ? String(e.precioNumero)
    : String(Math.round(e.precioNumero * 100) / 100)
  let t = `PROD:${nombre}|PRECIO:${precio}`
  if (op.mostrarUrl) t += '|URL:https://analitica360.app'
  return t
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function etiquetasDeProductos(productos: ProductoFila[], variantes: VarianteFila[]): EtiquetaImpresion[] {
  const porProd = new Map<string, VarianteFila[]>()
  for (const v of variantes) {
    if (!v.activo) continue
    const arr = porProd.get(v.productoId) ?? []
    arr.push(v)
    porProd.set(v.productoId, arr)
  }
  const out: EtiquetaImpresion[] = []
  for (const p of productos) {
    const vars = porProd.get(p.id) ?? []
    if (vars.length > 0) {
      for (const v of vars) {
        const monto = precioVarianteOBase(v.precioVenta, p.precio_venta)
        out.push({
          nombre: p.nombre,
          variante: etiquetaAtributosLarga(v.atributos) || null,
          precio: formatoARS(monto),
          precioNumero: monto,
          codigo: ean13DesdeEntidad(v.id),
        })
      }
      continue
    }
    const codigo = p.codigo_barra?.trim()
    if (!codigo) continue
    out.push({
      nombre: p.nombre,
      variante: null,
      precio: formatoARS(p.precio_venta),
      precioNumero: p.precio_venta,
      codigo,
    })
  }
  return out
}

function htmlHojaEtiquetas(
  etiquetas: EtiquetaImpresion[],
  extras: { svg: string | null; qr: string | null }[],
  op: OpcionesEtiqueta,
) {
  const t = TAMANO_CSS[op.tamano]
  const cards = etiquetas
    .map((e, i) => {
      const extra = extras[i]
      const vis = textoVisible(e, op)
      const partes: string[] = []
      if (op.mostrarNombre) {
        partes.push(`<p class="nombre">${escapeHtml(vis.nombre)}</p>`)
      }
      if (op.mostrarVariante && vis.variante) {
        partes.push(`<p class="var">${escapeHtml(vis.variante)}</p>`)
      }
      if (op.mostrarPrecio) {
        partes.push(`<p class="precio">${escapeHtml(e.precio)}</p>`)
      }
      if (op.mostrarBarras && extra.svg) {
        partes.push(`<div class="barra">${extra.svg}</div><p class="codigo">${escapeHtml(e.codigo)}</p>`)
      }
      if (op.mostrarQr && extra.qr) {
        partes.push(`<div class="pie">
          <img class="qr" src="${extra.qr}" alt="" width="80" height="80" />
          <p class="hint">Escaneá con celular</p>
        </div>`)
      }
      if (op.mostrarUrl) {
        partes.push('<p class="url">analitica360.app</p>')
      }
      return `<article class="etiqueta">${partes.join('')}</article>`
    })
    .join('')
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      color: #1A2F4A;
      background: #fff;
    }
    .hoja {
      display: grid;
      grid-template-columns: repeat(${t.cols}, ${t.w});
      gap: 2mm;
      justify-content: start;
      align-content: start;
    }
    .etiqueta {
      width: ${t.w};
      height: ${t.h};
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .nombre {
      margin: 0;
      font-size: ${op.tamano === 'grande' ? '13px' : op.tamano === 'pequena' ? '8px' : '11px'};
      font-weight: 700;
      line-height: 1.2;
      max-height: 2.4em;
      overflow: hidden;
    }
    .var {
      margin: 0.5mm 0 0;
      font-size: 8px;
      color: #4A5568;
      line-height: 1.2;
      max-height: 2.4em;
      overflow: hidden;
    }
    .precio {
      margin: 1mm 0;
      font-size: ${op.tamano === 'pequena' ? '9px' : '12px'};
      font-weight: 700;
    }
    .barra { width: 100%; }
    .barra svg { width: 100%; height: ${t.barraH}; display: block; }
    .codigo {
      margin: 0.5mm 0 0;
      font-size: 8px;
      letter-spacing: 0.04em;
    }
    .pie {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      width: 100%;
      margin-top: 1mm;
    }
    .qr {
      width: ${t.qr};
      height: ${t.qr};
      object-fit: contain;
    }
    .hint {
      margin: 0;
      font-size: 7px;
      color: #4A5568;
      text-align: left;
      line-height: 1.2;
    }
    .url {
      margin: 0.5mm 0 0;
      font-size: 7px;
      color: #4A5568;
    }
    @media print {
      body { background: #fff; }
      .hoja { gap: 2mm; }
    }
  </style>
</head>
<body>
  <div class="hoja">${cards}</div>
</body>
</html>`
}

const imprimirEtiqueta = (contenidoHTML: string) => {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const limpiar = () => {
    if (iframe.parentNode) document.body.removeChild(iframe)
  }

  let hecho = false
  const disparar = () => {
    if (hecho) return
    hecho = true
    iframe.contentWindow?.print()
    window.setTimeout(limpiar, 800)
  }

  iframe.onload = () => {
    disparar()
  }

  iframe.contentDocument?.write(contenidoHTML)
  iframe.contentDocument?.close()

  window.setTimeout(() => {
    if (iframe.contentDocument?.readyState === 'complete') disparar()
  }, 400)
}

export async function imprimirEtiquetas(
  etiquetas: EtiquetaImpresion[],
  opciones?: OpcionesEtiqueta,
): Promise<string | null> {
  if (etiquetas.length === 0) return 'No hay etiquetas para imprimir'
  const op = aplicarCamposPorTamano(opciones ?? leerOpcionesEtiqueta())
  const t = TAMANO_CSS[op.tamano]
  const extras = await Promise.all(
    etiquetas.map(async (e) => {
      const svg = op.mostrarBarras ? await svgCodigoBarras(e.codigo) : null
      const qr = op.mostrarQr ? await qrDataUrl(textoQr(e, op), t.qrPx) : null
      return { svg, qr }
    }),
  )
  imprimirEtiqueta(htmlHojaEtiquetas(etiquetas, extras, op))
  return null
}
