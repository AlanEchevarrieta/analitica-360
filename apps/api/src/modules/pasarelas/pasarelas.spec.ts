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
