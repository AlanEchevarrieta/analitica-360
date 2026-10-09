import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { debeRenovar, idPagoDelAviso, pagoCorresponde, pkce, urlAutorizacion } from './mp-tienda.util.js';

describe('OAuth', () => {
  it('PKCE S256: el desafío es el sha256 del verificador', () => {
    const { verificador, desafio } = pkce();
    expect(verificador.length).toBeGreaterThanOrEqual(43);
    expect(desafio).toBe(createHash('sha256').update(verificador).digest('base64url'));
    expect(pkce().verificador).not.toBe(verificador);
  });

  it('la URL de autorización lleva todo lo que pide Mercado Pago', () => {
    const u = new URL(urlAutorizacion({ clientId: '123', redirectUri: 'https://api.x/mercadopago/tienda/vuelta', state: 'v1.a.b.c', desafio: 'zzz' }));
    expect(u.origin + u.pathname).toBe('https://auth.mercadopago.com/authorization');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: '123',
      response_type: 'code',
      platform_id: 'mp',
      state: 'v1.a.b.c',
      redirect_uri: 'https://api.x/mercadopago/tienda/vuelta',
      code_challenge: 'zzz',
      code_challenge_method: 'S256',
    });
  });

  it('renueva el token si vence en menos de una semana', () => {
    const ahora = new Date('2026-10-08T12:00:00Z');
    expect(debeRenovar(new Date('2026-10-14T12:00:00Z'), ahora)).toBe(true);
    expect(debeRenovar(new Date('2026-10-20T12:00:00Z'), ahora)).toBe(false);
  });
});

describe('pagos', () => {
  const pedido = { id: '11111111-1111-1111-1111-111111111111', total: 46_800 };

  it('el pago corresponde si es de ese pedido y por el total (un peso de tolerancia)', () => {
    expect(pagoCorresponde({ id: 1, status: 'approved', external_reference: pedido.id, transaction_amount: 46_800 }, pedido)).toBe(true);
    expect(pagoCorresponde({ id: 1, status: 'approved', external_reference: pedido.id, transaction_amount: 46_799.5 }, pedido)).toBe(true);
    expect(pagoCorresponde({ id: 1, status: 'approved', external_reference: pedido.id, transaction_amount: 100 }, pedido)).toBe(false);
    expect(pagoCorresponde({ id: 1, status: 'approved', external_reference: 'otro', transaction_amount: 46_800 }, pedido)).toBe(false);
  });

  it('lee el id del pago de los avisos nuevos y de los viejos; ignora los que no son de pagos', () => {
    expect(idPagoDelAviso({}, { type: 'payment', data: { id: '123456' } })).toBe('123456');
    expect(idPagoDelAviso({}, { action: 'payment.updated', data: { id: 99 } })).toBe('99');
    expect(idPagoDelAviso({ topic: 'payment', id: '777' }, {})).toBe('777');
    expect(idPagoDelAviso({ type: 'payment', 'data.id': '888' }, null)).toBe('888');
    expect(idPagoDelAviso({}, { type: 'merchant_order', data: { id: '1' } })).toBeNull();
    expect(idPagoDelAviso({}, { type: 'payment', data: { id: '1; DROP' } })).toBeNull();
  });
});
