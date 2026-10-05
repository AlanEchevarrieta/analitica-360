import type { Cifra, DatosInforme } from './informes-datos.service.js';
import { titulo } from './informe.pdf.js';
import { entero, nombrePeriodo, pct, pesos } from './informes.util.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Asunto: "Informe semanal de Acacia: $ 1.234.567 en ventas (+12%)". */
export function asuntoInforme(d: DatosInforme): string {
  const v = d.ventas.variacion == null ? '' : ` (${pct(d.ventas.variacion)})`;
  return `${titulo(d)} de ${d.empresa}: ${pesos(d.ventas.valor)} en ventas${v}`;
}

function celda(etiqueta: string, valor: string, c: Cifra): string {
  const color = c.variacion == null || c.variacion === 0 ? '#6b7280' : c.variacion > 0 ? '#15803d' : '#b91c1c';
  const comp = c.variacion == null ? '&nbsp;' : `${pct(c.variacion)} vs. anterior`;
  return `<td style="padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;width:33%">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">${etiqueta}</div>
    <div style="font-size:20px;font-weight:bold;color:#111827;margin-top:4px">${valor}</div>
    <div style="font-size:12px;font-weight:bold;color:${color};margin-top:2px">${comp}</div>
  </td>`;
}

/** Cuerpo del email: los 3 números clave, el botón a la app y la baja. El detalle va en el PDF adjunto. */
export function htmlInforme(d: DatosInforme, urlApp: string, urlBaja: string): string {
  const periodo = esc(nombrePeriodo(d.tipo, d.periodo));
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#4f46e5;padding:24px">
      <div style="font-size:11px;color:#c7d2fe;letter-spacing:1.5px;font-weight:bold">ANALÍTICA 360</div>
      <div style="font-size:22px;color:#ffffff;font-weight:bold;margin-top:6px">${esc(titulo(d))} · ${esc(d.empresa)}</div>
      <div style="font-size:14px;color:#e0e7ff;margin-top:4px">${periodo}</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 16px;font-size:15px">Así te fue ${d.tipo === 'semanal' ? 'la semana pasada' : 'el mes pasado'}:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="8"><tr>
        ${celda('Ventas', pesos(d.ventas.valor), d.ventas)}
        ${celda('Ganancia', pesos(d.ganancia.valor), d.ganancia)}
        ${celda('Cantidad de ventas', entero(d.cantidad.valor), d.cantidad)}
      </tr></table>
      <p style="margin:16px 0;font-size:14px;color:#374151">En el PDF adjunto tenés el detalle: ventas por día, lo más vendido, cómo te pagaron, stock bajo${d.tipo === 'mensual' ? ', quién te debe y tu monotributo' : ''}.</p>
      <p style="margin:24px 0;text-align:center"><a href="${esc(urlApp)}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px">Ver en la app</a></p>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280">
      Te llega porque estás en la cuenta de ${esc(d.empresa)} en Analítica 360. Se configura en Configuración → Informes.<br>
      <a href="${esc(urlBaja)}" style="color:#6b7280">No quiero recibir más el ${d.tipo === 'semanal' ? 'informe semanal' : 'informe mensual'}</a>
    </td></tr>
  </table></body></html>`;
}

export function textoInforme(d: DatosInforme, urlApp: string, urlBaja: string): string {
  const linea = (e: string, v: string, c: Cifra) => `${e}: ${v}${c.variacion == null ? '' : ` (${pct(c.variacion)} vs. anterior)`}`;
  return [
    `${titulo(d)} de ${d.empresa} · ${nombrePeriodo(d.tipo, d.periodo)}`,
    '',
    linea('Ventas', pesos(d.ventas.valor), d.ventas),
    linea('Ganancia', pesos(d.ganancia.valor), d.ganancia),
    linea('Cantidad de ventas', entero(d.cantidad.valor), d.cantidad),
    '',
    'El detalle está en el PDF adjunto.',
    `Ver en la app: ${urlApp}`,
    '',
    `No quiero recibir más este informe: ${urlBaja}`,
  ].join('\n');
}
