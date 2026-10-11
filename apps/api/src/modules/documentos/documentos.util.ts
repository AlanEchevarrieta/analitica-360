import { createHmac, timingSafeEqual } from 'node:crypto';

export type TipoDocumento = 'venta' | 'recibo' | 'presupuesto';
export const TIPOS_DOCUMENTO: TipoDocumento[] = ['venta', 'recibo', 'presupuesto'];

export const TITULO: Record<TipoDocumento, string> = { venta: 'Comprobante de venta', recibo: 'Recibo', presupuesto: 'Presupuesto' };
export const LEYENDA_NO_FACTURA = 'Documento no válido como factura.';

/** Días que dura el link que se manda por WhatsApp. */
export const DIAS_LINK = 60;

/** "R-000012", "P-000003". */
export const numeroDocumento = (prefijo: 'R' | 'P', n: number) => `${prefijo}-${String(n).padStart(6, '0')}`;

const NOMBRE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  qr: 'Mercado Pago QR',
  mp_qr: 'Mercado Pago QR',
  cuenta_corriente: 'Cuenta corriente',
};
export const nombrePago = (forma: string) => NOMBRE_PAGO[forma] ?? forma.charAt(0).toUpperCase() + forma.slice(1).replace(/_/g, ' ');

/** "comprobante-V-000654.pdf" */
export function nombreArchivo(tipo: TipoDocumento, numero: string): string {
  const base = { venta: 'comprobante', recibo: 'recibo', presupuesto: 'presupuesto' }[tipo];
  return `${base}-${numero.replace(/[^\w-]/g, '')}.pdf`;
}

// ---- Link público firmado (para mandar el PDF por WhatsApp sin sesión) ----

const firma = (secreto: string, datos: string) => createHmac('sha256', `documentos:${secreto}`).update(datos).digest('base64url');

/** `vence` en AAAA-MM-DD: después de esa fecha el link deja de andar. */
export function tokenDocumento(secreto: string, empresaId: string, tipo: TipoDocumento, id: string, vence: string): string {
  const datos = Buffer.from(JSON.stringify([empresaId, tipo, id, vence])).toString('base64url');
  return `${datos}.${firma(secreto, datos)}`;
}

export function leerTokenDocumento(secreto: string, token: string, hoy: string): { empresaId: string; tipo: TipoDocumento; id: string } | null {
  const [datos, f] = token.split('.');
  if (!datos || !f) return null;
  const esperada = Buffer.from(firma(secreto, datos));
  const recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const [empresaId, tipo, id, vence] = JSON.parse(Buffer.from(datos, 'base64url').toString()) as [string, TipoDocumento, string, string];
    if (!TIPOS_DOCUMENTO.includes(tipo) || typeof empresaId !== 'string' || typeof id !== 'string' || typeof vence !== 'string') return null;
    if (vence < hoy) return null;
    return { empresaId, tipo, id };
  } catch {
    return null;
  }
}

/** wa.me necesita el número internacional: un celular argentino de 10 dígitos pasa a 549 + número (el 0 de larga distancia se saca). */
export function telefonoWhatsApp(telefono: string | null | undefined): string | null {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.length < 8) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return `549${d}`;
  if (d.length === 12 && d.startsWith('54') && !d.startsWith('549')) return `549${d.slice(2)}`;
  return d;
}

/** Mensaje de WhatsApp que acompaña el link. */
export function mensajeWhatsApp(d: { tipo: TipoDocumento; numero: string; cliente: string | null; negocio: string; total: string; url: string }): string {
  const saludo = `Hola${d.cliente ? ` ${d.cliente.split(' ')[0]}` : ''}!`;
  const que = { venta: `el comprobante de tu compra ${d.numero}`, recibo: `el recibo ${d.numero} de tu pago`, presupuesto: `el presupuesto ${d.numero}` }[d.tipo];
  return `${saludo} Te mandamos ${que} por ${d.total}. Lo podés ver y descargar acá: ${d.url}\n${d.negocio}`;
}
