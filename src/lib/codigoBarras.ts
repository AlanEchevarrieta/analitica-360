import { formatoARS, type ProductoFila } from './productos'
import { precioVarianteOBase, type VarianteFila } from './variantes'

export type EtiquetaImpresion = {
  nombre: string
  variante: string | null
  precio: string
  codigo: string
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
        out.push({
          nombre: p.nombre,
          variante: etiquetaAtributosLarga(v.atributos) || null,
          precio: formatoARS(precioVarianteOBase(v.precioVenta, p.precio_venta)),
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
      codigo,
    })
  }
  return out
}

export async function imprimirEtiquetas(
  etiquetas: EtiquetaImpresion[],
  winPrevia?: Window | null,
): Promise<string | null> {
  if (etiquetas.length === 0) return 'No hay etiquetas para imprimir'
  const win = winPrevia ?? window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!win) return 'Permití ventanas emergentes para imprimir las etiquetas'
  const svgs = await Promise.all(etiquetas.map((e) => svgCodigoBarras(e.codigo)))
  const cards = etiquetas
    .map((e, i) => {
      const varHtml = e.variante
        ? `<p class="var">${escapeHtml(e.variante)}</p>`
        : ''
      return `<article class="etiqueta">
        <p class="nombre">${escapeHtml(e.nombre)}</p>
        ${varHtml}
        <p class="precio">${escapeHtml(e.precio)}</p>
        <div class="barra">${svgs[i]}</div>
        <p class="codigo">${escapeHtml(e.codigo)}</p>
      </article>`
    })
    .join('')
  win.document.open()
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas</title>
  <style>
    @page { margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      color: #1A2F4A;
      background: #fff;
    }
    .hoja {
      display: grid;
      grid-template-columns: repeat(3, 6cm);
      gap: 4mm;
      justify-content: start;
      padding: 4mm;
    }
    .etiqueta {
      width: 6cm;
      height: 4cm;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .nombre {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      max-height: 2.4em;
      overflow: hidden;
    }
    .var {
      margin: 1mm 0 0;
      font-size: 9px;
      color: #4A5568;
      line-height: 1.2;
      max-height: 2.4em;
      overflow: hidden;
    }
    .precio {
      margin: 1.5mm 0;
      font-size: 12px;
      font-weight: 700;
    }
    .barra { width: 100%; }
    .barra svg { width: 100%; height: 12mm; display: block; }
    .codigo {
      margin: 1mm 0 0;
      font-size: 9px;
      letter-spacing: 0.04em;
    }
    @media print {
      body { background: #fff; }
      .hoja { padding: 0; gap: 3mm; }
    }
  </style>
</head>
<body>
  <div class="hoja">${cards}</div>
</body>
</html>`)
  win.document.close()
  let hecho = false
  const imprimir = () => {
    if (hecho) return
    hecho = true
    win.focus()
    win.print()
  }
  if (win.document.readyState === 'complete') imprimir()
  else win.addEventListener('load', imprimir, { once: true })
  window.setTimeout(imprimir, 400)
  return null
}
