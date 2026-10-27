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
export class MercadoPagoAdapter implements PasarelaAdapter {
  readonly proveedor: ProveedorPasarela = 'mercadopago';
  private readonly logger = new Logger('MercadoPagoAdapter');

  async crearCobro(
    credenciales: Record<string, string>,
    input: CrearCobroInput,
    webhookUrlBase: string,
  ): Promise<CobroGeneradoResult> {
    const accessToken = credenciales.accessToken;
    if (!accessToken) throw new Error('Falta el accessToken de Mercado Pago');

    const body = {
      items: [
        {
          id: input.origenId ?? 'cobro_general',
          title: input.concepto.slice(0, 250),
          quantity: 1,
          unit_price: Number(input.monto),
          currency_id: input.moneda || 'ARS',
        },
      ],
      payer: {
        name: input.clienteNombre?.slice(0, 100) || 'Cliente',
        email: input.clienteEmail || 'cliente@analitica360.com',
      },
      external_reference: input.origenId || `ref_${Date.now()}`,
      notification_url: `${webhookUrlBase}/pasarelas/webhook/mercadopago`,
      back_urls: input.urlVuelta
        ? {
            success: input.urlVuelta,
            failure: input.urlVuelta,
            pending: input.urlVuelta,
          }
        : undefined,
      auto_return: input.urlVuelta ? 'approved' : undefined,
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.error(`Error al crear preferencia en Mercado Pago: ${res.status} ${errText}`);
      throw new Error(`Error en Mercado Pago: ${res.statusText}`);
    }

    const data = (await res.json()) as { id: string; init_point: string; sandbox_init_point?: string };
    const comision = Math.round(input.monto * 0.044 * 1.21 * 100) / 100; // ~4.4% + IVA

    return {
      idExterno: data.id,
      urlPago: data.init_point,
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
    const accessToken = credenciales.accessToken;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${idExterno}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return { idExterno, estado: 'pendiente', monto: 0 };
    }

    const data = (await res.json()) as {
      status: string;
      transaction_amount: number;
      date_approved?: string;
      fee_details?: Array<{ amount: number }>;
    };

    const estadoMap: Record<string, 'aprobado' | 'rechazado' | 'pendiente'> = {
      approved: 'aprobado',
      rejected: 'rechazado',
      cancelled: 'rechazado',
      in_process: 'pendiente',
      pending: 'pendiente',
    };

    const comision = data.fee_details?.reduce((acc, f) => acc + (f.amount || 0), 0);

    return {
      idExterno,
      estado: estadoMap[data.status] ?? 'pendiente',
      monto: Number(data.transaction_amount || 0),
      pagadoEn: data.date_approved ? new Date(data.date_approved) : null,
      comision,
    };
  }

  async procesarWebhook(
    credenciales: Record<string, string>,
    _webhookSecret: string | null,
    payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookEventoResult> {
    const p = payload as Record<string, unknown> | undefined;
    const paymentId = (p?.data as { id?: string })?.id || (p?.id as string);

    if (!paymentId) {
      return { reconocido: false, proveedor: this.proveedor };
    }

    try {
      const detalle = await this.consultarPago(credenciales, String(paymentId));
      return {
        reconocido: true,
        proveedor: this.proveedor,
        idExterno: detalle.idExterno,
        estadoNuevo: detalle.estado,
        montoPagado: detalle.monto,
        pagadoEn: detalle.pagadoEn ?? new Date(),
        metadata: { fee: detalle.comision },
      };
    } catch (e) {
      return {
        reconocido: false,
        proveedor: this.proveedor,
        error: e instanceof Error ? e.message : 'Error consultando pago en MP',
      };
    }
  }
}
