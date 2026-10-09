// Email que acompaña a la Factura C (el PDF va adjunto).

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pesos = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export interface DatosEmailFactura {
  emisor: string;
  comprobante: string;
  numero: string;
  fecha: string;
  total: number;
  cae: string;
  receptor: string | null;
  prueba: boolean;
}

export const asuntoFactura = (d: DatosEmailFactura) => `${d.comprobante} ${d.numero} de ${d.emisor}${d.prueba ? ' (prueba)' : ''}`;

export function textoFactura(d: DatosEmailFactura): string {
  return [
    d.receptor ? `Hola, ${d.receptor}:` : 'Hola:',
    '',
    `Te enviamos la ${d.comprobante} ${d.numero} del ${d.fecha} por ${pesos(d.total)}. Está adjunta en PDF.`,
    `CAE: ${d.cae}.`,
    ...(d.prueba ? ['', 'Es un comprobante de prueba de ARCA: no tiene validez fiscal.'] : []),
    '',
    `Gracias por tu compra.`,
    d.emisor,
  ].join('\n');
}

export function htmlFactura(d: DatosEmailFactura): string {
  const e = escapar;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 16px;font-size:15px">${d.receptor ? `Hola, ${e(d.receptor)}:` : 'Hola:'}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Te enviamos la <strong>${e(d.comprobante)} ${e(d.numero)}</strong> del ${e(d.fecha)}. Está adjunta en PDF.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;padding:14px;font-size:14px">
<tr><td style="color:#6b7280">Total</td><td align="right" style="font-weight:bold">${e(pesos(d.total))}</td></tr>
<tr><td style="color:#6b7280;padding-top:6px">CAE</td><td align="right" style="padding-top:6px">${e(d.cae)}</td></tr>
</table>
${d.prueba ? '<p style="margin:16px 0 0;font-size:13px;color:#b45309">Es un comprobante de prueba de ARCA: no tiene validez fiscal.</p>' : ''}
<p style="margin:20px 0 0;font-size:15px">Gracias por tu compra.<br><strong>${e(d.emisor)}</strong></p>
</td></tr></table>
<p style="font-size:11px;color:#9ca3af;margin:12px 0 0">Enviado con Analítica 360</p>
</td></tr></table></body></html>`;
}
