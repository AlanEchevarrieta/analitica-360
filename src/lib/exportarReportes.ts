import type { AnalyticsPeriodo } from './analytics'
import { fechaExactaLarga, ticketPromedio } from './analytics'
import { formatoARS } from './productos'
import {
  etiquetaCuotas,
  etiquetaFormaPago,
  formatoFechaVenta,
  type VentaFila,
} from './ventas'

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

export function nombreArchivoVentas(empresa: string, ext: 'xlsx' | 'pdf') {
  return `ventas_${slugEmpresa(empresa)}_${fechaArchivo()}.${ext}`
}

export function nombreArchivoAnalytics(empresa: string) {
  return `analytics_${slugEmpresa(empresa)}_${fechaArchivo()}.pdf`
}

function filasExcel(ventas: VentaFila[]) {
  return ventas.map((v) => ({
    Fecha: formatoFechaVenta(v.fecha),
    Productos: v.productos,
    Total: v.total,
    'Forma de pago': etiquetaFormaPago(v.forma_pago),
    Cuotas: etiquetaCuotas(v.cuotas),
    Cliente: v.cliente ?? '',
    Descuento: v.descuento,
    Notas: v.notas ?? '',
  }))
}

export async function exportarVentasExcel(input: { empresa: string; ventas: VentaFila[] }) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(filasExcel(input.ventas))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
  XLSX.writeFile(wb, nombreArchivoVentas(input.empresa, 'xlsx'))
}

export async function exportarVentasPdf(input: {
  empresa: string
  desde: string
  hasta: string
  ventas: VentaFila[]
}) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const total = input.ventas.reduce((acc, v) => acc + v.total, 0)
  const cantidad = input.ventas.length
  const ticket = cantidad > 0 ? total / cantidad : 0

  doc.setFontSize(16)
  doc.setTextColor(26, 47, 74)
  doc.text(input.empresa, 40, 36)
  doc.setFontSize(12)
  doc.setTextColor(99, 102, 241)
  doc.text('Reporte de Ventas', 40, 54)
  doc.setFontSize(10)
  doc.setTextColor(74, 85, 104)
  doc.text(`Período: ${input.desde} a ${input.hasta}`, 40, 70)

  autoTable(doc, {
    startY: 84,
    head: [['Fecha', 'Productos', 'Total', 'Forma de pago', 'Cuotas', 'Cliente', 'Descuento', 'Notas']],
    body: input.ventas.map((v) => [
      formatoFechaVenta(v.fecha),
      v.productos,
      formatoARS(v.total),
      etiquetaFormaPago(v.forma_pago),
      etiquetaCuotas(v.cuotas),
      v.cliente ?? '—',
      formatoARS(v.descuento),
      v.notas ?? '',
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    margin: { left: 40, right: 40 },
  })

  const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 84
  doc.setFontSize(10)
  doc.setTextColor(26, 47, 74)
  doc.text(`Total del período: ${formatoARS(total)}`, 40, y + 22)
  doc.text(`Transacciones: ${cantidad}`, 40, y + 38)
  doc.text(`Ticket promedio: ${formatoARS(ticket)}`, 40, y + 54)

  const pageCount = doc.getNumberOfPages()
  const pie = `Generado por Analítica 360 · ${fechaArchivo()}`
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(pie, 40, doc.internal.pageSize.getHeight() - 24)
  }

  doc.save(nombreArchivoVentas(input.empresa, 'pdf'))
}

export async function exportarAnalyticsPdf(input: {
  empresa: string
  desde: string
  hasta: string
  data: AnalyticsPeriodo
}) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const ticket = ticketPromedio(input.data.total, input.data.cantidad)
  const margen =
    input.data.total > 0 ? ((input.data.total - input.data.costo) / input.data.total) * 100 : 0

  doc.setFontSize(16)
  doc.setTextColor(26, 47, 74)
  doc.text(input.empresa, 40, 40)
  doc.setFontSize(12)
  doc.setTextColor(99, 102, 241)
  doc.text('Reporte de Analytics', 40, 58)
  doc.setFontSize(10)
  doc.setTextColor(74, 85, 104)
  doc.text(
    `Período: ${fechaExactaLarga(input.desde)} — ${fechaExactaLarga(input.hasta)}`,
    40,
    74,
  )

  autoTable(doc, {
    startY: 90,
    head: [['KPI', 'Valor']],
    body: [
      ['Total ventas', formatoARS(input.data.total)],
      ['Transacciones', String(input.data.cantidad)],
      ['Ticket promedio', formatoARS(ticket)],
      ['Margen bruto estimado', `${margen.toFixed(1)}%`],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    margin: { left: 40, right: 40 },
  })

  const yTop = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90
  doc.setFontSize(12)
  doc.setTextColor(26, 47, 74)
  doc.text('Top 10 productos', 40, yTop + 28)

  autoTable(doc, {
    startY: yTop + 36,
    head: [['Producto', 'Unidades']],
    body: input.data.top10.map((p) => [p.nombre, String(p.unidades)]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    margin: { left: 40, right: 40 },
  })

  const yProd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yTop
  doc.setFontSize(12)
  doc.setTextColor(26, 47, 74)
  doc.text('Rendimiento por producto', 40, yProd + 28)

  autoTable(doc, {
    startY: yProd + 36,
    head: [['Producto', 'Unidades', 'Total', 'Costo', 'Margen', 'Margen %']],
    body: input.data.productos.map((p) => [
      p.producto,
      String(p.unidades),
      formatoARS(p.total),
      formatoARS(p.costo),
      formatoARS(p.margen),
      `${p.margen_pct.toFixed(1)}%`,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    margin: { left: 40, right: 40 },
  })

  const pageCount = doc.getNumberOfPages()
  const pie = `Generado por Analítica 360 · ${fechaArchivo()}`
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(pie, 40, doc.internal.pageSize.getHeight() - 24)
  }

  doc.save(nombreArchivoAnalytics(input.empresa))
}
