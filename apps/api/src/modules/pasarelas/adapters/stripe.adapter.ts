import { createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  CobroGeneradoResult,
  CrearCobroInput,
  DetallePagoResult,
  ProveedorPasarela,
  WebhookEventoResult,
} from '../pasarelas.types.js';
import type { PasarelaAdapter } from './pasarela.adapter.interface.js';

@Injectable()
export class StripeAdapter implements PasarelaAdapter {
  readonly proveedor: ProveedorPasarela = 'stripe';
  private readonly logger = new Logger('StripeAdapter');

  async crearCobro(
    credenciales: Record<string, string>,
    input: CrearCobroInput,
    _webhookUrlBase: string,
  ): Promise<CobroGeneradoResult> {
    const secretKey = credenciales.secretKey;
    if (!secretKey) throw new Error('Falta el secretKey de Stripe');

    const moneda = (input.moneda || 'ars').toLowerCase();
    // Stripe requiere los montos en centavos (ej: $1000 = 100000)
    const unitAmount = Math.round(Number(input.monto) * 100);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append(
      'success_url',
      input.urlVuelta
        ? `${input.urlVuelta}?stripe=ok&session_id={CHECKOUT_SESSION_ID}`
        : 'https://analitica360.com',
    );
    params.append(
      'cancel_url',
      input.urlVuelta ? `${input.urlVuelta}?stripe=cancelado` : 'https://analitica360.com',
    );
    params.append('client_reference_id', input.origenId || `ref_${Date.now()}`);

    if (input.clienteEmail) {
      params.append('customer_email', input.clienteEmail);
    }

    params.append('line_items[0][price_data][currency]', moneda);
    params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    params.append(
      'line_items[0][price_data][product_data][name]',
      input.concepto.slice(0, 200),
    );
    params.append('line_items[0][quantity]', '1');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      this.logger.error(`Error al crear Checkout Session en Stripe: ${res.status} ${err}`);
      throw new Error('Error al conectar con Stripe Checkout');
    }

    const data = (await res.json()) as { id: string; url: string };
    const comision = Math.round((input.monto * 0.039 + 0.3) * 100) / 100;

    return {
      idExterno: data.id,
      urlPago: data.url,
      qrData: null,
      estado: 'pendiente',
      comisionEstimada: comision,
      montoNeto: Math.max(0, input.monto - comision),
    };
  }

  async consultarPago(
    credenciales: Record<string, string>,
    idExterno: string,
  ): Promise<DetallePagoResult> {
    const secretKey = credenciales.secretKey;
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${idExterno}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!res.ok) {
      return { idExterno, estado: 'pendiente', monto: 0 };
    }

    const data = (await res.json()) as {
      payment_status: string;
      status: string;
      amount_total?: number;
    };

    const estado =
      data.payment_status === 'paid'
        ? 'aprobado'
        : data.status === 'expired'
          ? 'expirado'
          : 'pendiente';

    return {
      idExterno,
      estado,
      monto: Number((data.amount_total || 0) / 100),
      pagadoEn: data.payment_status === 'paid' ? new Date() : null,
    };
  }

  async procesarWebhook(
    credenciales: Record<string, string>,
    webhookSecret: string | null,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookEventoResult> {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = headers['stripe-signature'];

    // Si se configuró webhookSecret, validamos la firma criptográfica HMAC-SHA256
    if (webhookSecret && typeof signature === 'string') {
      const parts = signature.split(',');
      const timestampPart = parts.find((p) => p.startsWith('t='))?.split('=')[1];
      const signaturePart = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

      if (timestampPart && signaturePart) {
        const hmac = createHmac('sha256', webhookSecret);
        hmac.update(`${timestampPart}.${rawPayload}`);
        const expected = hmac.digest('hex');
        if (expected !== signaturePart) {
          this.logger.warn('Firma de webhook de Stripe inválida');
          return { reconocido: false, proveedor: this.proveedor, error: 'Firma inválida' };
        }
      }
    }

    const event = (typeof payload === 'string' ? JSON.parse(payload) : payload) as {
      type: string;
      data?: { object?: Record<string, unknown> };
    };

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object as {
        id: string;
        payment_status: string;
        amount_total?: number;
      };

      if (session?.payment_status === 'paid') {
        return {
          reconocido: true,
          proveedor: this.proveedor,
          idExterno: session.id,
          estadoNuevo: 'aprobado',
          montoPagado: Number((session.amount_total || 0) / 100),
          pagadoEn: new Date(),
        };
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data?.object as { id: string };
      return {
        reconocido: true,
        proveedor: this.proveedor,
        idExterno: pi?.id,
        estadoNuevo: 'rechazado',
      };
    }

    return { reconocido: false, proveedor: this.proveedor };
  }
}
