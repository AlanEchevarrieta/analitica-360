import PDFDocument from 'pdfkit';

/** Datos del negocio para el encabezado (los del remitente de Configuración). */
export interface NegocioDoc {
  nombre: string;
  cuit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  /** PNG o JPG (PDFKit no lee WEBP). */
  logo: Buffer | null;
}

export interface DatosDocumentoPdf {
  negocio: NegocioDoc;
  /** "Presupuesto", "Comprobante de venta", "Recibo". */
  titulo: string;
  numero: string;
  fecha: string;
  /** Líneas extra debajo de la fecha (ej. "Válido hasta: 26/10/2026"). */
  extras: string[];
  cliente: { nombre: string | null; telefono: string | null; email: string | null } | null;
  /** Sin ítems (recibo): se muestra solo el resumen. */
  items: { descripcion: string; cantidad: number; precio: number }[] | null;
  /** Renglones antes del total (subtotal, descuento, envío, seña…). */
  resumen: { etiqueta: string; monto: number }[];
  total: { etiqueta: string; monto: number };
  /** Renglones debajo del total (forma de pago, saldo pendiente…). */
  detalles: string[];
  notas: string | null;
  pie: string | null;
  leyenda: string;
  simbolo: string;
}

const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const cuitConGuiones = (c: string) => (/^\d{11}$/.test(c) ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);

/** PDF de un documento comercial que no es factura (comprobante de venta, recibo, presupuesto). */
export async function pdfDocumento(d: DatosDocumentoPdf): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `${d.titulo} ${d.numero}`, Author: d.negocio.nombre } });
  const partes: Buffer[] = [];
  doc.on('data', (b: Buffer) => partes.push(b));
  const listo = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(partes))));
  const ancho = 595.28 - 72;
  const fin = 841.89 - 60;
  const plata = (n: number) => `${n < 0 ? '-' : ''}${d.simbolo} ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const gris = '#6b7280';
  const tinta = '#111827';

  // Encabezado: logo y negocio a la izquierda; tipo, número y fecha a la derecha.
  let x = 36;
  if (d.negocio.logo) {
    try {
      doc.image(d.negocio.logo, 36, 36, { fit: [70, 70] });
      x = 118;
    } catch {
      // Un logo que no se puede leer no frena el documento.
    }
  }
  doc.fillColor(tinta).font('Helvetica-Bold').fontSize(15).text(d.negocio.nombre, x, 38, { width: ancho / 2 + 36 - x });
  doc.font('Helvetica').fontSize(8.5).fillColor(gris);
  for (const l of [d.negocio.cuit && `CUIT ${cuitConGuiones(d.negocio.cuit)}`, d.negocio.direccion, d.negocio.telefono, d.negocio.email]) if (l) doc.text(l, { width: ancho / 2 + 36 - x });
  const yIzq = doc.y;

  const xDer = 36 + ancho / 2 + 20;
  doc.fillColor(tinta).font('Helvetica-Bold').fontSize(16).text(d.titulo.toUpperCase(), xDer, 38, { width: ancho / 2 - 20, align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`N.º ${d.numero}`, { width: ancho / 2 - 20, align: 'right' });
  doc.fontSize(9).fillColor(gris).text(`Fecha: ${dmy(d.fecha)}`, { width: ancho / 2 - 20, align: 'right' });
  for (const e of d.extras) doc.text(e, { width: ancho / 2 - 20, align: 'right' });

  let y = Math.max(yIzq, doc.y, 110) + 14;
  doc.moveTo(36, y).lineTo(36 + ancho, y).lineWidth(0.8).strokeColor('#d1d5db').stroke();
  y += 12;

  // Cliente
  if (d.cliente) {
    doc.fillColor(gris).font('Helvetica').fontSize(8).text('CLIENTE', 36, y);
    doc.fillColor(tinta).font('Helvetica-Bold').fontSize(10).text(d.cliente.nombre || 'Consumidor final', 36, y + 11);
    const contacto = [d.cliente.telefono, d.cliente.email].filter(Boolean).join(' · ');
    if (contacto) doc.font('Helvetica').fontSize(8.5).fillColor(gris).text(contacto);
    y = doc.y + 14;
  }

  // Detalle
  if (d.items?.length) {
    const col = { desc: 44, cant: 36 + ancho * 0.58, precio: 36 + ancho * 0.7, sub: 36 + ancho * 0.85 };
    const cabecera = () => {
      doc.rect(36, y, ancho, 18).fill('#f3f4f6');
      doc.fillColor(tinta).font('Helvetica-Bold').fontSize(8.5);
      doc.text('Producto', col.desc, y + 5).text('Cant.', col.cant, y + 5, { width: 44, align: 'right' }).text('Precio', col.precio, y + 5, { width: 70, align: 'right' }).text('Subtotal', col.sub, y + 5, { width: ancho * 0.15 - 8, align: 'right' });
      y += 24;
      doc.font('Helvetica').fontSize(8.5);
    };
    cabecera();
    for (const it of d.items) {
      const alto = Math.max(doc.heightOfString(it.descripcion, { width: ancho * 0.52 }), 11);
      if (y + alto > fin) {
        doc.addPage();
        y = 36;
        cabecera();
      }
      doc.fillColor(tinta).text(it.descripcion, col.desc, y, { width: ancho * 0.52 });
      doc.text(it.cantidad.toLocaleString('es-AR'), col.cant, y, { width: 44, align: 'right' }).text(plata(it.precio), col.precio, y, { width: 70, align: 'right' }).text(plata(it.cantidad * it.precio), col.sub, y, { width: ancho * 0.15 - 8, align: 'right' });
      y += alto + 6;
    }
    y += 4;
  }

  // Resumen y total
  if (y > fin - 120) {
    doc.addPage();
    y = 36;
  }
  const xRes = 36 + ancho * 0.5;
  for (const r of d.resumen) {
    doc.fillColor(gris).font('Helvetica').fontSize(9).text(r.etiqueta, xRes, y, { width: ancho * 0.3 }).fillColor(tinta).text(plata(r.monto), xRes, y, { width: ancho * 0.5, align: 'right' });
    y += 14;
  }
  doc.moveTo(xRes, y + 2).lineTo(36 + ancho, y + 2).lineWidth(1).strokeColor(tinta).stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(tinta).text(d.total.etiqueta, xRes, y, { width: ancho * 0.25 }).text(plata(d.total.monto), xRes, y, { width: ancho * 0.5, align: 'right' });
  y += 22;
  doc.font('Helvetica').fontSize(9);
  for (const l of d.detalles) {
    doc.fillColor(gris).text(l, xRes, y, { width: ancho * 0.5, align: 'right' });
    y = doc.y + 2;
  }

  if (d.notas) {
    y += 14;
    if (y > fin - 40) {
      doc.addPage();
      y = 36;
    }
    doc.fillColor(gris).font('Helvetica').fontSize(8).text('NOTAS', 36, y);
    doc.fillColor(tinta).fontSize(9).text(d.notas, 36, y + 11, { width: ancho });
  }

  // Pie de la última página (sin abrir una página nueva).
  const pagina = doc.page;
  pagina.margins.bottom = 0;
  const yPie = 841.89 - 64;
  if (d.pie) doc.fillColor(tinta).font('Helvetica').fontSize(9).text(d.pie, 36, yPie - 16, { width: ancho, align: 'center', lineBreak: false });
  doc.fillColor(gris).fontSize(7.5).text(d.leyenda, 36, yPie, { width: ancho, align: 'center', lineBreak: false });
  doc.fontSize(7).text('Generado con Analítica 360', 36, yPie + 12, { width: ancho, align: 'center', lineBreak: false });

  doc.end();
  return listo;
}
