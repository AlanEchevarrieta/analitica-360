import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { firmaValida } from './mercadopago.util.js';

const secreto = 'clave-secreta-de-prueba';
const firmar = (manifiesto: string) => createHmac('sha256', secreto).update(manifiesto).digest('hex');

describe('firmaValida (webhooks de Mercado Pago)', () => {
  it('acepta la firma correcta (data.id alfanumérico en minúsculas)', () => {
    const v1 = firmar('id:abc123;request-id:req-1;ts:1700000000;');
    expect(firmaValida({ firma: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123', secreto })).toBe(true);
  });
  it('rechaza otra clave, otro id o una firma incompleta', () => {
    const v1 = firmar('id:123;request-id:req-1;ts:1700000000;');
    expect(firmaValida({ firma: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '124', secreto })).toBe(false);
    expect(firmaValida({ firma: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '123', secreto: 'otra' })).toBe(false);
    expect(firmaValida({ firma: 'ts=1700000000', requestId: 'req-1', dataId: '123', secreto })).toBe(false);
    expect(firmaValida({ firma: undefined, requestId: 'req-1', dataId: '123', secreto })).toBe(false);
  });
  it('sin request-id, el manifiesto lo omite', () => {
    const v1 = firmar('id:99;ts:5;');
    expect(firmaValida({ firma: `ts=5,v1=${v1}`, requestId: undefined, dataId: '99', secreto })).toBe(true);
  });
});
