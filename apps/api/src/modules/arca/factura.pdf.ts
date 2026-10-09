import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { CONDICION_IVA, DOC, NOMBRE_TIPO, numeroCompleto, urlQR } from './arca.util.js';

export interface DatosFacturaPdf {
  emisor: { razonSocial: string; cuit: string; domicilio: string; iibb: string | null; inicioActividades: string | null };
  tipo: number;
  puntoVenta: number;
  numero: number;
  fecha: string;
  receptor: { nombre: string | null; docTipo: number; docNro: string; condicionIva: number };
  items: { descripcion: string; cantidad: number; precio: number }[];
  total: number;
  cae: string;
  caeVence: string;
  /** Nota de crédito: la factura que anula. */
  asociado: string | null;
  homologacion: boolean;
}

const pesos = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dmy = (iso: string) => iso.split('-').reverse().join('/');
const cuitConGuiones = (c: string) => `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
const CONDICION: Record<number, string> = { [CONDICION_IVA.CONSUMIDOR_FINAL]: 'Consumidor final', [CONDICION_IVA.MONOTRIBUTO]: 'Responsable monotributo', [CONDICION_IVA.RESPONSABLE_INSCRIPTO]: 'IVA responsable inscripto', [CONDICION_IVA.EXENTO]: 'IVA exento' };

/** PDF de la Factura C o Nota de crédito C, con el QR de ARCA (RG 4291). */
export async function pdfFactura(d: DatosFacturaPdf): Promise<Buffer> {
  const qr = await QRCode.toBuffer(urlQR({ fecha: d.fecha, cuit: d.emisor.cuit, puntoVenta: d.puntoVenta, tipo: d.tipo, numero: d.numero, total: d.total, docTipo: d.receptor.docTipo, docNro: d.receptor.docNro, cae: d.cae }), { margin: 0, width: 220 });
  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `${NOMBRE_TIPO[d.tipo]} ${numeroCompleto(d.puntoVenta, d.numero)}`, Author: d.emisor.razonSocial } });
  const partes: Buffer[] = [];
  doc.on('data', (b: Buffer) => partes.push(b));
  const listo = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(partes))));
  const ancho = 595.28 - 72;

  if (d.homologacion) doc.font('Helvetica-Bold').fontSize(9).fillColor('#b91c1c').text('COMPROBANTE DE PRUEBA (homologación de ARCA): no tiene validez fiscal', 36, 20, { width: ancho, align: 'center' });

  // Encabezado: emisor a la izquierda, letra C al medio, datos del comprobante a la derecha.
  doc.lineWidth(1).strokeColor('#111827').rect(36, 36, ancho, 120).stroke();
  doc.moveTo(36 + ancho / 2, 36).lineTo(36 + ancho / 2, 156).stroke();
  doc.rect(36 + ancho / 2 - 22, 36, 44, 40).fillAndStroke('#ffffff', '#111827');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(26).text('C', 36 + ancho / 2 - 22, 42, { width: 44, align: 'center' });
  doc.font('Helvetica').fontSize(7).text(`COD. ${String(d.tipo).padStart(3, '0')}`, 36 + ancho / 2 - 22, 66, { width: 44, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(14).text(d.emisor.razonSocial, 46, 84, { width: ancho / 2 - 40 });
  doc.font('Helvetica').fontSize(8.5).text(d.emisor.domicilio, { width: ancho / 2 - 40 }).text('Responsable monotributo');
  doc.font('Helvetica-Bold').fontSize(13).text(NOMBRE_TIPO[d.tipo].toUpperCase(), 36 + ancho / 2 + 30, 46);
  doc.font('Helvetica').fontSize(9).text(`Punto de venta y número: ${numeroCompleto(d.puntoVenta, d.numero)}`, 36 + ancho / 2 + 30, 66);
  doc.text(`Fecha: ${dmy(d.fecha)}`);
  doc.text(`CUIT: ${cuitConGuiones(d.emisor.cuit)}`);
  if (d.emisor.iibb) doc.text(`Ingresos brutos: ${d.emisor.iibb}`);
  if (d.emisor.inicioActividades) doc.text(`Inicio de actividades: ${dmy(d.emisor.inicioActividades)}`);

  // Receptor
  let y = 168;
  doc.rect(36, y, ancho, 48).stroke();
  const docTexto = d.receptor.docTipo === DOC.CUIT ? `CUIT ${cuitConGuiones(d.receptor.docNro)}` : d.receptor.docTipo === DOC.DNI ? `DNI ${d.receptor.docNro}` : 'Sin identificar';
  doc.font('Helvetica').fontSize(9).text(`Cliente: ${d.receptor.nombre ?? 'Consumidor final'}`, 46, y + 9).text(`${docTexto} · ${CONDICION[d.receptor.condicionIva] ?? ''}`);
  if (d.asociado) doc.text(`Anula: ${d.asociado}`);

  // Detalle
  y += 62;
  const col = { desc: 46, cant: 36 + ancho * 0.6, precio: 36 + ancho * 0.72, sub: 36 + ancho * 0.86 };
  doc.rect(36, y, ancho, 18).fill('#f3f4f6');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5);
  doc.text('Producto', col.desc, y + 5).text('Cant.', col.cant, y + 5, { width: 40, align: 'right' }).text('Precio', col.precio, y + 5, { width: 60, align: 'right' }).text('Subtotal', col.sub, y + 5, { width: 64, align: 'right' });
  y += 24;
  doc.font('Helvetica').fontSize(8.5);
  for (const it of d.items) {
    doc.text(it.descripcion, col.desc, y, { width: ancho * 0.55 });
    const alto = doc.y - y;
    doc.text(it.cantidad.toLocaleString('es-AR'), col.cant, y, { width: 40, align: 'right' }).text(pesos(it.precio), col.precio, y, { width: 60, align: 'right' }).text(pesos(it.cantidad * it.precio), col.sub, y, { width: 64, align: 'right' });
    y += Math.max(alto, 12) + 4;
  }

  // Total
  y = Math.max(y + 10, 520);
  doc.moveTo(36, y).lineTo(36 + ancho, y).stroke();
  doc.font('Helvetica-Bold').fontSize(13).text(`Total: ${pesos(d.total)}`, 36, y + 10, { width: ancho, align: 'right' });

  // Pie: QR y CAE
  const yPie = 700;
  doc.image(qr, 36, yPie, { width: 90 });
  doc.font('Helvetica-Bold').fontSize(10).text('Comprobante autorizado por ARCA', 140, yPie + 10);
  doc.font('Helvetica').fontSize(9).text(`CAE: ${d.cae}`, 140, yPie + 30).text(`Vencimiento del CAE: ${dmy(d.caeVence)}`);
  doc.fontSize(7).fillColor('#6b7280').text('Generado con Analítica 360', 140, yPie + 76);

  doc.end();
  return listo;
}
