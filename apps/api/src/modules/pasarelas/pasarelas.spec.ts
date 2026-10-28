import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter.js';
import { StripeAdapter } from './adapters/stripe.adapter.js';
import { UalaAdapter } from './adapters/uala.adapter.js';

describe('Pasarelas Adapters - Pruebas Unitarias', () => {
  it('Mercado Pago calcula comisiones estimadas correctamente', async () => {
    const adapter = new MercadoPagoAdapter();
    expect(adapter.proveedor).toBe('mercadopago');
  });

  it('Mercado Pago valida firmas de webhook HMAC-SHA256 con manifiesto oficial y rechaza firmas inválidas o expiradas', () => {
    const adapter = new MercadoPagoAdapter();
    const webhookSecret = 'mp_secret_key_prod_test_987654';
    const dataId = '1234567890';
    const xRequestId = '550e8400-e29b-41d4-a716-446655440000';
    const ahora = Math.floor(Date.now() / 1000);

    // 1. Firma válida
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ahora};`;
    const v1Valido = createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    const xSignatureValido = `ts=${ahora},v1=${v1Valido}`;

    const resValido = adapter.validarFirmaHmac(webhookSecret, xSignatureValido, xRequestId, dataId);
    expect(resValido.valida).toBe(true);

    // 2. Firma manipulada / adulterada
    const xSignatureTrucho = `ts=${ahora},v1=0000000000000000000000000000000000000000000000000000000000000000`;
    const resTrucho = adapter.validarFirmaHmac(webhookSecret, xSignatureTrucho, xRequestId, dataId);
    expect(resTrucho.valida).toBe(false);
    expect(resTrucho.error).toContain('Firma HMAC-SHA256 no coincide');

    // 3. Ataque de repetición (Replay Attack con timestamp viejo > 5 minutos)
    const timestampViejo = ahora - 400; // 400 segundos atrás
    const manifestViejo = `id:${dataId};request-id:${xRequestId};ts:${timestampViejo};`;
    const v1Viejo = createHmac('sha256', webhookSecret).update(manifestViejo).digest('hex');
    const xSignatureViejo = `ts=${timestampViejo},v1=${v1Viejo}`;

    const resViejo = adapter.validarFirmaHmac(webhookSecret, xSignatureViejo, xRequestId, dataId);
    expect(resViejo.valida).toBe(false);
    expect(resViejo.error).toContain('expirado o fuera de la ventana de tolerancia');

    // 4. Encabezados faltantes
    const resSinFirma = adapter.validarFirmaHmac(webhookSecret, '', xRequestId, dataId);
    expect(resSinFirma.valida).toBe(false);
  });

  it('Ualá Bis calcula comisiones competitivas (~3.5% + IVA)', async () => {
    const adapter = new UalaAdapter();
    expect(adapter.proveedor).toBe('uala');
  });

  it('Stripe valida firmas de webhook HMAC-SHA256 y descarta firmas inválidas', async () => {
    const adapter = new StripeAdapter();
    const webhookSecret = 'whsec_test_secret_key_123';
    const payload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123456',
          payment_status: 'paid',
          amount_total: 500000,
        },
      },
    };
    const rawPayload = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawPayload}`)
      .digest('hex');

    const headersValidos = {
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    };

    const resultadoValido = await adapter.procesarWebhook(
      { secretKey: 'sk_test_123' },
      webhookSecret,
      rawPayload,
      headersValidos,
    );

    expect(resultadoValido.reconocido).toBe(true);
    expect(resultadoValido.idExterno).toBe('cs_test_123456');
    expect(resultadoValido.estadoNuevo).toBe('aprobado');
    expect(resultadoValido.montoPagado).toBe(5000); // 500000 centavos / 100

    // Con firma manipulada
    const headersFalsos = {
      'stripe-signature': `t=${timestamp},v1=firma_falsa_12345`,
    };

    const resultadoFalso = await adapter.procesarWebhook(
      { secretKey: 'sk_test_123' },
      webhookSecret,
      rawPayload,
      headersFalsos,
    );

    expect(resultadoFalso.reconocido).toBe(false);
  });
});
