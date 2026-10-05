import PDFDocument from 'pdfkit';
import type { Cifra, DatosInforme } from './informes-datos.service.js';
import { ddmm, ddmmaaaa, diaSemana, dolares, entero, nombrePeriodo, pct, pesos } from './informes.util.js';

const C = {
  marca: '#4f46e5',
  marcaSuave: '#eef2ff',
  texto: '#111827',
  gris: '#6b7280',
  linea: '#e5e7eb',
  fondo: '#f9fafb',
  sube: '#15803d',
  baja: '#b91c1c',
  alerta: '#b45309',
};

const ANCHO = 595.28; // A4
const MARGEN = 40;
const UTIL = ANCHO - MARGEN * 2;

type Doc = PDFKit.PDFDocument;

/** Arma el PDF del informe (A4, una o dos páginas). */
export function pdfInforme(d: DatosInforme, generado: Date = new Date()): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGEN, bufferPages: true, info: { Title: `${titulo(d)} · ${d.empresa}`, Author: 'Analítica 360' } });
  const partes: Buffer[] = [];
  doc.on('data', (b: Buffer) => partes.push(b));
  const listo = new Promise<Buffer>((ok, mal) => {
    doc.on('end', () => ok(Buffer.concat(partes)));
    doc.on('error', mal);
  });

  encabezado(doc, d);
  let y = 130;
  if (d.demasiadasVentas) {
    doc.font('Helvetica').fontSize(10).fillColor(C.alerta).text('El período tiene más de 50.000 ventas: el detalle se ve en Analytics, dentro de la app.', MARGEN, y, { width: UTIL });
    y += 24;
  }
  y = tarjetas(doc, d, y);
  y = grafico(doc, d, y + 18);
  y = dosColumnas(
    doc,
    y + 18,
    (x, w, y0) => tabla(doc, x, w, y0, 'Más vendidos', ['Producto', 'Unid.', 'Total'], d.masVendidos.map((p) => [p.nombre, entero(p.unidades), pesos(p.total)]), 'Sin ventas en el período.'),
    (x, w, y0) =>
      tabla(doc, x, w, y0, 'Cómo te pagaron', ['Forma de pago', 'Ventas', 'Total'], d.formasPago.map((f) => [f.nombre, entero(f.cantidad), pesos(f.total)]), 'Sin ventas en el período.'),
  );
  y = dosColumnas(
    doc,
    y + 14,
    (x, w, y0) => tabla(doc, x, w, y0, 'Stock bajo (hoy)', ['Producto', 'Stock'], d.stockBajo.map((s) => [s.nombre, entero(s.stock)]), 'Ningún producto en el mínimo.'),
    (x, w, y0) => {
      let yy = bloque(doc, x, w, y0, 'Compras del período', [[d.usd ? `${pesos(d.compras.valor)} (${dolares(d.usd.compras)})` : pesos(d.compras.valor), d.compras.variacion, true]]);
      const sin = d.sinVentas.cantidad
        ? `${entero(d.sinVentas.cantidad)} producto${d.sinVentas.cantidad === 1 ? '' : 's'} sin ventas: ${d.sinVentas.ejemplos.join(', ')}${d.sinVentas.cantidad > d.sinVentas.ejemplos.length ? '…' : ''}`
        : 'Todos tus productos tuvieron ventas.';
      yy = titulito(doc, x, yy + 12, 'No se vendieron');
      doc.font('Helvetica').fontSize(9).fillColor(C.texto).text(sin, x, yy, { width: w });
      return doc.y;
    },
  );

  if (d.tipo === 'mensual') {
    // Pasa a otra página solo si no entra (cuenta corriente: título + encabezado + deudores).
    const alto = 14 + 18 + 15 * ((d.cuentaCorriente?.deudores.length ?? 0) + 1) + 10;
    if (y + Math.max(alto, 80) > 790) {
      doc.addPage();
      y = MARGEN;
    }
    y = dosColumnas(
      doc,
      y + 14,
      (x, w, y0) =>
        d.cuentaCorriente
          ? tabla(
              doc,
              x,
              w,
              y0,
              d.cuentaCorriente.total > 0 ? `Te deben: ${pesos(d.cuentaCorriente.total)}` : 'Cuenta corriente',
              ['Cliente', 'Días', 'Saldo'],
              d.cuentaCorriente.deudores.map((c) => [c.nombre, entero(c.dias), pesos(c.saldo)]),
              'Nadie te debe.',
            )
          : y0,
      (x, w, y0) => monotributo(doc, x, w, y0, d),
    );
  }
  pie(doc, generado);
  doc.end();
  return listo;
}

export const titulo = (d: Pick<DatosInforme, 'tipo'>) => (d.tipo === 'semanal' ? 'Informe semanal' : 'Informe mensual');

function encabezado(doc: Doc, d: DatosInforme) {
  doc.rect(0, 0, ANCHO, 100).fill(C.marca);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#c7d2fe').text('ANALÍTICA 360', MARGEN, 26, { characterSpacing: 1.5 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(`${titulo(d)} · ${d.empresa}`, MARGEN, 42, { width: UTIL, ellipsis: true, height: 28 });
  const rango = d.tipo === 'semanal' ? `Del lunes ${ddmm(d.periodo.desde)} al domingo ${ddmmaaaa(d.periodo.hasta)}` : nombrePeriodo('mensual', d.periodo);
  const dolar = d.usd ? `  ·  US$: dólar ${d.usd.casa === 'bolsa' ? 'MEP' : d.usd.casa} del día de cada venta` : '';
  doc.font('Helvetica').fontSize(11).fillColor('#e0e7ff').text(`${rango}  ·  comparado con ${d.tipo === 'semanal' ? 'la semana' : 'el mes'} anterior${dolar}`, MARGEN, 72, { width: UTIL });
}

function colorDe(v: number | null, subirEsBueno = true) {
  if (v == null || v === 0) return C.gris;
  return v > 0 === subirEsBueno ? C.sube : C.baja;
}

function tarjetas(doc: Doc, d: DatosInforme, y: number): number {
  const u = d.usd;
  const margen = d.margenPct == null ? null : `margen ${d.margenPct.toLocaleString('es-AR')}%`;
  const items: [string, string, Cifra, string?][] = [
    ['Ventas', pesos(d.ventas.valor), d.ventas, u ? dolares(u.ventas) : undefined],
    ['N.º de ventas', entero(d.cantidad.valor), d.cantidad],
    ['Ticket promedio', pesos(d.ticket.valor), d.ticket, u ? dolares(u.ticket) : undefined],
    ['Ganancia', pesos(d.ganancia.valor), d.ganancia, [margen, u ? dolares(u.ganancia) : null].filter(Boolean).join(' · ') || undefined],
  ];
  const gap = 10;
  const w = (UTIL - gap * 3) / 4;
  const h = 78;
  items.forEach(([etiqueta, valor, c, extra], i) => {
    const x = MARGEN + i * (w + gap);
    doc.roundedRect(x, y, w, h, 8).fillAndStroke(C.fondo, C.linea);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.gris).text(etiqueta.toUpperCase(), x + 10, y + 10, { width: w - 20, characterSpacing: 0.5 });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.texto).text(valor, x + 10, y + 26, { width: w - 20, height: 18, ellipsis: true });
    const comp = c.variacion == null ? 'sin datos para comparar' : `${pct(c.variacion)} vs. anterior`;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colorDe(c.variacion)).text(comp, x + 10, y + 48, { width: w - 20 });
    if (extra) doc.font('Helvetica').fontSize(8.5).fillColor(C.gris).text(extra, x + 10, y + 60, { width: w - 20 });
  });
  return y + h;
}

function grafico(doc: Doc, d: DatosInforme, y: number): number {
  const yy = titulito(doc, MARGEN, y, 'Ventas por día');
  const alto = 120;
  const base = yy + alto;
  const max = Math.max(...d.dias.map((x) => x.total), 1);
  const n = d.dias.length;
  const paso = UTIL / n;
  const ancho = Math.min(paso * 0.65, 40);
  doc.moveTo(MARGEN, base).lineTo(MARGEN + UTIL, base).lineWidth(0.5).strokeColor(C.linea).stroke();
  d.dias.forEach((dia, i) => {
    const h = (dia.total / max) * (alto - 16);
    const x = MARGEN + i * paso + (paso - ancho) / 2;
    if (h > 0) doc.roundedRect(x, base - h, ancho, h, Math.min(3, ancho / 2)).fill(C.marca);
    const etiqueta = n <= 7 ? `${diaSemana(dia.fecha).slice(0, 3)} ${dia.fecha.slice(8, 10)}` : i % 3 === 0 || i === n - 1 ? dia.fecha.slice(8, 10) : '';
    if (etiqueta) doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(etiqueta, MARGEN + i * paso - 6, base + 4, { width: paso + 12, align: 'center' });
    // En la semanal, el monto arriba de cada barra.
    if (n <= 7 && dia.total > 0) doc.font('Helvetica').fontSize(7.5).fillColor(C.texto).text(pesos(dia.total), MARGEN + i * paso - 10, base - h - 11, { width: paso + 20, align: 'center' });
  });
  const mejor = d.dias.reduce((a, b) => (b.total > a.total ? b : a), d.dias[0]);
  if (mejor && mejor.total > 0) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.gris).text(`Mejor día: ${diaSemana(mejor.fecha)} ${ddmm(mejor.fecha)} con ${pesos(mejor.total)}`, MARGEN, base + 18);
  }
  return base + 30;
}

function titulito(doc: Doc, x: number, y: number, texto: string): number {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.texto).text(texto, x, y);
  return y + 18;
}

function dosColumnas(doc: Doc, y: number, izq: (x: number, w: number, y: number) => number, der: (x: number, w: number, y: number) => number): number {
  const gap = 20;
  const w = (UTIL - gap) / 2;
  const a = izq(MARGEN, w, y);
  const b = der(MARGEN + w + gap, w, y);
  return Math.max(a, b);
}

function tabla(doc: Doc, x: number, w: number, y: number, tit: string, cols: string[], filas: string[][], vacio: string): number {
  let yy = titulito(doc, x, y, tit);
  if (!filas.length) {
    doc.font('Helvetica').fontSize(9).fillColor(C.gris).text(vacio, x, yy, { width: w });
    return doc.y;
  }
  // Primera columna ancha, las demás a la derecha.
  const otras = cols.length - 1;
  const wOtra = otras === 2 ? 74 : 60;
  const w0 = w - wOtra * otras;
  const fila = (valores: string[], negrita: boolean, color: string) => {
    valores.forEach((v, i) => {
      const cx = i === 0 ? x : x + w0 + (i - 1) * wOtra;
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(color).text(v, cx, yy, { width: i === 0 ? w0 - 6 : wOtra, align: i === 0 ? 'left' : 'right', height: 11, ellipsis: true });
    });
    yy += 15;
  };
  fila(cols, true, C.gris);
  doc.moveTo(x, yy - 3).lineTo(x + w, yy - 3).lineWidth(0.5).strokeColor(C.linea).stroke();
  for (const f of filas) fila(f, false, C.texto);
  return yy;
}

function bloque(doc: Doc, x: number, w: number, y: number, tit: string, valores: [string, number | null, boolean][]): number {
  let yy = titulito(doc, x, y, tit);
  for (const [v, varia, subirEsBueno] of valores) {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(C.texto).text(v, x, yy, { continued: varia != null });
    if (varia != null) doc.font('Helvetica-Bold').fontSize(9).fillColor(colorDe(varia, subirEsBueno)).text(`   ${pct(varia)} vs. anterior`);
    yy = doc.y + 2;
  }
  return yy;
}

function monotributo(doc: Doc, x: number, w: number, y: number, d: DatosInforme): number {
  const m = d.monotributo;
  if (!m) return y;
  let yy = titulito(doc, x, y, `Monotributo${m.categoria ? ` · categoría ${m.categoria}` : ''}`);
  if (m.usoPct != null) {
    const uso = Math.min(Math.max(m.usoPct, 0), 100);
    const color = m.usoPct >= 90 ? C.baja : m.usoPct >= 75 ? C.alerta : C.sube;
    doc.roundedRect(x, yy, w, 10, 5).fill(C.linea);
    if (uso > 0) doc.roundedRect(x, yy, Math.max((w * uso) / 100, 10), 10, 5).fill(color);
    yy += 16;
    doc.font('Helvetica').fontSize(9).fillColor(C.texto).text(`Usaste el ${m.usoPct.toLocaleString('es-AR', { maximumFractionDigits: 0 })}% del tope de los últimos 12 meses.`, x, yy, { width: w });
    if (m.margenDisponible != null) doc.text(`Podés facturar ${pesos(Math.max(m.margenDisponible, 0))} más sin cambiar de categoría.`, { width: w });
  }
  if (m.usoPct == null) {
    doc.font('Helvetica').fontSize(9).fillColor(C.texto).text('Cargá tu categoría en la Configuración fiscal de la app para ver cuánto te queda del tope.', x, yy, { width: w });
    yy = doc.y + 2;
  } else {
    yy = doc.y + 2;
  }
  doc.font('Helvetica').fontSize(9).fillColor(C.gris).text(`A este ritmo, en un año: ${pesos(m.proyeccionAnual)}${m.categoriaProyectada ? ` (categoría ${m.categoriaProyectada})` : ''}.`, x, yy, { width: w });
  return doc.y;
}

function pie(doc: Doc, generado: Date) {
  const cuando = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(generado);
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    // Sin margen de abajo: si no, escribir el pie abre una página nueva.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(`Generado por Analítica 360 el ${cuando}  ·  Los montos son lo cobrado, sin lo que quedó a cuenta.  ·  analitica360.app`, MARGEN, 805, {
      width: UTIL,
      align: 'center',
      lineBreak: false,
    });
  }
}
