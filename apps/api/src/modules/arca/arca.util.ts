/**
 * Factura electrónica de ARCA (ex AFIP): lo que no depende de la red.
 * - WSAA: pedido de acceso (TRA) que se firma con el certificado y devuelve token y firma.
 * - WSFEv1: pedido de CAE para Factura C (monotributo) y nota de crédito C.
 * - QR obligatorio en el comprobante impreso (RG 4291).
 */

export type Ambiente = 'homologacion' | 'produccion';

export const URLS: Record<Ambiente, { wsaa: string; wsfe: string }> = {
  homologacion: { wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms', wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx' },
  produccion: { wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms', wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx' },
};

/** Tipos de comprobante de ARCA que usamos. */
export const TIPO = { FACTURA_C: 11, NOTA_DEBITO_C: 12, NOTA_CREDITO_C: 13 } as const;
export type TipoComprobante = (typeof TIPO)[keyof typeof TIPO];
export const NOMBRE_TIPO: Record<number, string> = { 11: 'Factura C', 12: 'Nota de débito C', 13: 'Nota de crédito C' };

/** Documento del receptor. Sin dato: consumidor final (99 / 0). */
export const DOC = { CUIT: 80, DNI: 96, SIN_IDENTIFICAR: 99 } as const;

/** Condición frente al IVA del receptor (obligatoria en el pedido desde 2025). */
export const CONDICION_IVA = { RESPONSABLE_INSCRIPTO: 1, EXENTO: 4, CONSUMIDOR_FINAL: 5, MONOTRIBUTO: 6 } as const;

/** CUIT válido: 11 dígitos y dígito verificador (módulo 11). */
export function cuitValido(cuit: string): boolean {
  const d = cuit.replace(/\D/g, '');
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) verificador = 9;
  return verificador === Number(d[10]);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Fecha y hora con zona de Argentina, como la espera el WSAA. */
const isoAR = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().replace(/\.\d{3}Z$/, '-03:00');

/** Pedido de acceso (TRA) al servicio `wsfe`, válido 10 minutos para arriba y para abajo. */
export function armarTRA(servicio: string, ahora: Date = new Date()): string {
  return `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId><generationTime>${isoAR(new Date(ahora.getTime() - 10 * 60_000))}</generationTime><expirationTime>${isoAR(new Date(ahora.getTime() + 10 * 60_000))}</expirationTime></header><service>${esc(servicio)}</service></loginTicketRequest>`;
}

export const sobreWsaa = (cmsBase64: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cmsBase64}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;

/** Valor de una etiqueta XML (la primera), sin importar el prefijo de espacio de nombres. */
export function etiqueta(xml: string, nombre: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`).exec(xml);
  return m ? m[1].trim() : null;
}

/** Todas las apariciones de una etiqueta (para errores y observaciones). */
export function etiquetas(xml: string, nombre: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1].trim());
}

const desescapar = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Respuesta del WSAA: el ticket viene escapado dentro de loginCmsReturn. */
export function leerTicketAcceso(respuesta: string): { token: string; firma: string; vence: Date } {
  const falla = etiqueta(respuesta, 'faultstring');
  if (falla) throw new Error(`ARCA (acceso): ${falla}`);
  const ticket = desescapar(etiqueta(respuesta, 'loginCmsReturn') ?? '');
  const token = etiqueta(ticket, 'token');
  const firma = etiqueta(ticket, 'sign');
  const vence = etiqueta(ticket, 'expirationTime');
  if (!token || !firma || !vence) throw new Error('ARCA (acceso): respuesta sin token');
  return { token, firma, vence: new Date(vence) };
}

export interface Auth {
  token: string;
  firma: string;
  /** CUIT del contribuyente que factura (el cliente que delegó el servicio). */
  cuit: string;
}

const auth = (a: Auth) => `<ar:Auth><ar:Token>${a.token}</ar:Token><ar:Sign>${a.firma}</ar:Sign><ar:Cuit>${a.cuit}</ar:Cuit></ar:Auth>`;
const sobreWsfe = (metodo: string, cuerpo: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soapenv:Header/><soapenv:Body><ar:${metodo}>${cuerpo}</ar:${metodo}></soapenv:Body></soapenv:Envelope>`;

export const pedidoUltimoAutorizado = (a: Auth, puntoVenta: number, tipo: number) =>
  sobreWsfe('FECompUltimoAutorizado', `${auth(a)}<ar:PtoVta>${puntoVenta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo>`);

export const pedidoDummy = () => sobreWsfe('FEDummy', '');

export interface DatosComprobante {
  tipo: TipoComprobante;
  puntoVenta: number;
  numero: number;
  /** AAAA-MM-DD */
  fecha: string;
  total: number;
  /** 1 productos, 2 servicios, 3 productos y servicios. */
  concepto: 1 | 2 | 3;
  docTipo: number;
  docNro: string;
  condicionIvaReceptor: number;
  /** Para notas de crédito: la factura que anulan. */
  asociado?: { tipo: number; puntoVenta: number; numero: number; cuit: string; fecha: string };
}

const yyyymmdd = (f: string) => f.replace(/-/g, '');
export const importe = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Pedido de CAE (FECAESolicitar) de un comprobante C: sin IVA discriminado, el neto es el total. */
export function pedidoCAE(a: Auth, d: DatosComprobante): string {
  const servicios = d.concepto !== 1 ? `<ar:FchServDesde>${yyyymmdd(d.fecha)}</ar:FchServDesde><ar:FchServHasta>${yyyymmdd(d.fecha)}</ar:FchServHasta><ar:FchVtoPago>${yyyymmdd(d.fecha)}</ar:FchVtoPago>` : '';
  const asociado = d.asociado
    ? `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${d.asociado.tipo}</ar:Tipo><ar:PtoVta>${d.asociado.puntoVenta}</ar:PtoVta><ar:Nro>${d.asociado.numero}</ar:Nro><ar:Cuit>${d.asociado.cuit}</ar:Cuit><ar:CbteFch>${yyyymmdd(d.asociado.fecha)}</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>`
    : '';
  return sobreWsfe(
    'FECAESolicitar',
    `${auth(a)}<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${d.puntoVenta}</ar:PtoVta><ar:CbteTipo>${d.tipo}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>` +
      `<ar:Concepto>${d.concepto}</ar:Concepto><ar:DocTipo>${d.docTipo}</ar:DocTipo><ar:DocNro>${d.docNro}</ar:DocNro>` +
      `<ar:CbteDesde>${d.numero}</ar:CbteDesde><ar:CbteHasta>${d.numero}</ar:CbteHasta><ar:CbteFch>${yyyymmdd(d.fecha)}</ar:CbteFch>` +
      `<ar:ImpTotal>${importe(d.total)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${importe(d.total)}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>0.00</ar:ImpIVA>` +
      `${servicios}<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIVAReceptorId>${d.condicionIvaReceptor}</ar:CondicionIVAReceptorId>${asociado}` +
      `</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`,
  );
}

/** Errores y observaciones de ARCA en una respuesta, como "código: mensaje". */
function mensajes(xml: string): string[] {
  const out: string[] = [];
  for (const bloque of [...etiquetas(xml, 'Err'), ...etiquetas(xml, 'Obs')]) {
    const code = etiqueta(bloque, 'Code');
    const msg = etiqueta(bloque, 'Msg');
    if (msg) out.push(code ? `${code}: ${desescapar(msg)}` : desescapar(msg));
  }
  const falla = etiqueta(xml, 'faultstring');
  if (falla) out.push(falla);
  return out;
}

export function leerUltimoAutorizado(xml: string): number {
  const n = etiqueta(xml, 'CbteNro');
  if (n == null) throw new Error(`ARCA: ${mensajes(xml).join(' · ') || 'no respondió el último número'}`);
  return Number(n);
}

export type ResultadoCAE = { aprobado: true; cae: string; vence: string; observaciones: string[] } | { aprobado: false; errores: string[] };

/** Respuesta de FECAESolicitar: A = aprobado (con CAE), R = rechazado. */
export function leerCAE(xml: string): ResultadoCAE {
  const resultado = etiqueta(etiqueta(xml, 'FECAEDetResponse') ?? '', 'Resultado') ?? etiqueta(xml, 'Resultado');
  const cae = etiqueta(xml, 'CAE');
  const vto = etiqueta(xml, 'CAEFchVto');
  if (resultado === 'A' && cae && vto) return { aprobado: true, cae, vence: `${vto.slice(0, 4)}-${vto.slice(4, 6)}-${vto.slice(6, 8)}`, observaciones: mensajes(xml) };
  return { aprobado: false, errores: mensajes(xml).length ? mensajes(xml) : ['ARCA rechazó el comprobante sin dar el motivo'] };
}

/** Link del QR del comprobante (RG 4291): https://www.afip.gob.ar/fe/qr/?p=<base64 del JSON>. */
export function urlQR(d: { fecha: string; cuit: string; puntoVenta: number; tipo: number; numero: number; total: number; docTipo: number; docNro: string; cae: string }): string {
  const datos = {
    ver: 1,
    fecha: d.fecha,
    cuit: Number(d.cuit),
    ptoVta: d.puntoVenta,
    tipoCmp: d.tipo,
    nroCmp: d.numero,
    importe: Number(importe(d.total)),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: d.docTipo,
    nroDocRec: Number(d.docNro),
    tipoCodAut: 'E',
    codAut: Number(d.cae),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(datos)).toString('base64')}`;
}

/** "00002-00000123" */
export const numeroCompleto = (puntoVenta: number, numero: number) => `${String(puntoVenta).padStart(5, '0')}-${String(numero).padStart(8, '0')}`;
