import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Firma de los webhooks de Mercado Pago (header x-signature: "ts=...,v1=...").
 * El manifiesto es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmado con
 * HMAC-SHA256 y la clave secreta de la aplicación. `data.id` va en minúsculas si es
 * alfanumérico. Si falta alguna parte, se omite del manifiesto (como indica MP).
 */
export function firmaValida(input: { firma: string | undefined; requestId: string | undefined; dataId: string | undefined; secreto: string }): boolean {
  if (!input.firma) return false;
  const partes = Object.fromEntries(
    input.firma.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  const id = input.dataId && /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifiesto = `${id ? `id:${id};` : ''}${input.requestId ? `request-id:${input.requestId};` : ''}ts:${ts};`;
  const esperado = createHmac('sha256', input.secreto).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cada cuántos meses cobra Mercado Pago según el ciclo del plan. */
export const MESES_MP: Record<'mensual' | 'trimestral' | 'anual', number> = { mensual: 1, trimestral: 3, anual: 12 };

/** Referencia del pago en Mercado Pago que queda en `pagos.referencia_externa` (evita registrar dos veces). */
export const referenciaPago = (authorizedPaymentId: string | number) => `mp-ap:${authorizedPaymentId}`;

/** Estados de una suscripción en Mercado Pago que significan "el débito automático está andando". */
export const ESTADOS_ACTIVOS = ['pending', 'authorized'];
