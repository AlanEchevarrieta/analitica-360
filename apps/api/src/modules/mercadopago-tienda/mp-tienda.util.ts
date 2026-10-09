import { createHash, randomBytes } from 'node:crypto';

// Mercado Pago en las tiendas: OAuth (cada comercio conecta su cuenta) y Checkout Pro.
// https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation

export const URL_AUTORIZACION = 'https://auth.mercadopago.com/authorization';

/** PKCE (S256): el verificador viaja cifrado en `state` y el desafío va a Mercado Pago. */
export function pkce(): { verificador: string; desafio: string } {
  const verificador = randomBytes(48).toString('base64url');
  return { verificador, desafio: createHash('sha256').update(verificador).digest('base64url') };
}

export function urlAutorizacion(datos: { clientId: string; redirectUri: string; state: string; desafio: string }): string {
  const q = new URLSearchParams({
    client_id: datos.clientId,
    response_type: 'code',
    platform_id: 'mp',
    state: datos.state,
    redirect_uri: datos.redirectUri,
    code_challenge: datos.desafio,
    code_challenge_method: 'S256',
  });
  return `${URL_AUTORIZACION}?${q.toString()}`;
}

/** Lo que va cifrado en `state`: de qué empresa es, el verificador PKCE y hasta cuándo vale (15 minutos). */
export interface EstadoOAuth {
  e: string;
  v: string;
  x: number;
}

/** El access token se renueva si vence en menos de una semana. */
export const debeRenovar = (venceEn: Date, ahora = new Date()) => venceEn.getTime() - ahora.getTime() < 7 * 24 * 3600 * 1000;

export interface PagoMp {
  id: number | string;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number;
  date_approved?: string | null;
}

/**
 * ¿Este pago es de ese pedido y por lo que hay que cobrar? Se tolera un peso de diferencia por redondeo;
 * un pago por menos no marca el pedido como pagado.
 */
export function pagoCorresponde(pago: PagoMp, pedido: { id: string; total: number }): boolean {
  return pago.external_reference === pedido.id && Number(pago.transaction_amount ?? 0) >= pedido.total - 1;
}

/** El id del pago en un aviso de Mercado Pago (formato webhook nuevo o IPN viejo). Null si el aviso no es de un pago. */
export function idPagoDelAviso(query: Record<string, unknown>, cuerpo: unknown): string | null {
  const b = (cuerpo ?? {}) as { type?: unknown; topic?: unknown; action?: unknown; data?: { id?: unknown } };
  const tipo = String(b.type ?? b.topic ?? query.type ?? query.topic ?? '');
  if (tipo !== 'payment' && !String(b.action ?? '').startsWith('payment.')) return null;
  const id = b.data?.id ?? query['data.id'] ?? query.id;
  return (typeof id === 'string' || typeof id === 'number') && /^\d{1,20}$/.test(String(id)) ? String(id) : null;
}

/** Estados de pago en criollo (los de Mercado Pago). */
export const NOMBRE_PAGO: Record<string, string> = {
  pendiente: 'Esperando el pago',
  pending: 'Pago pendiente',
  in_process: 'Pago en revisión',
  authorized: 'Pago autorizado',
  approved: 'Pagado',
  rejected: 'Pago rechazado',
  cancelled: 'Pago cancelado',
  refunded: 'Pago devuelto',
  charged_back: 'Contracargo',
};
