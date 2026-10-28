import { createHmac, timingSafeEqual } from 'node:crypto';
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

    const notificationUrl = input.negocioSlug
      ? `${webhookUrlBase}/pasarelas/webhook/${encodeURIComponent(input.negocioSlug)}/mercadopago`
      : `${webhookUrlBase}/pasarelas/webhook/mercadopago`;

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
      notification_url: notificationUrl,
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

  /**
   * Valida la firma criptográfica HMAC-SHA256 (x-signature) enviada por Mercado Pago.
   * Template del manifiesto: id:[data.id];request-id:[x-request-id];ts:[ts];
   */
  validarFirmaHmac(
    webhookSecret: string,
    xSignature: string,
    xRequestId: string,
    dataId: string,
  ): { valida: boolean; error?: string } {
    if (!xSignature || !xRequestId || !dataId) {
      return {
        valida: false,
        error: 'Faltan encabezados requeridos (x-signature o x-request-id) o el identificador del evento',
      };
    }

    // Extraer ts y v1
    const partes = xSignature.split(',');
    let ts: string | undefined;
    let v1: string | undefined;

    for (const p of partes) {
      const [k, ...vParts] = p.trim().split('=');
      const v = vParts.join('=');
      if (k === 'ts') ts = v;
      if (k === 'v1') v1 = v;
    }

    if (!ts || !v1) {
      return { valida: false, error: 'Formato de x-signature inválido (debe contener ts y v1)' };
    }

    // Regla de seguridad: Ventana de tolerancia anti-repetición (Replay attack: 5 minutos / 300 segundos)
    const timestamp = parseInt(ts, 10);
    const ahoraSegundos = Math.floor(Date.now() / 1000);
    if (isNaN(timestamp) || Math.abs(ahoraSegundos - timestamp) > 300) {
      return {
        valida: false,
        error: 'Timestamp de firma expirado o fuera de la ventana de tolerancia (posible replay attack)',
      };
    }

    // Manifiesto estándar de Mercado Pago: id:[data.id];request-id:[x-request-id];ts:[ts];
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const hmacEsperado = createHmac('sha256', webhookSecret).update(manifest).digest('hex');

    // Comparación en tiempo constante para mitigar ataques de canal lateral (timing attacks)
    const hmacEsperadoBuf = Buffer.from(hmacEsperado, 'utf8');
    const v1Buf = Buffer.from(v1, 'utf8');

    if (hmacEsperadoBuf.length !== v1Buf.length || !timingSafeEqual(hmacEsperadoBuf, v1Buf)) {
      return { valida: false, error: 'Firma HMAC-SHA256 no coincide con el secret configurado' };
    }

    return { valida: true };
  }

  async procesarWebhook(
    credenciales: Record<string, string>,
    webhookSecret: string | null,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<WebhookEventoResult> {
    const p = payload as Record<string, unknown> | undefined;

    // El ID del recurso en Mercado Pago puede venir en query (?data.id=... o ?id=...) o en body
    const queryDataId = Array.isArray(query?.['data.id'])
      ? query?.['data.id'][0]
      : (query?.['data.id'] as string | undefined);
    const queryId = Array.isArray(query?.id) ? query?.id[0] : (query?.id as string | undefined);

    const paymentId =
      queryDataId ||
      queryId ||
      (p?.data as { id?: string | number })?.id ||
      (p?.id as string | number);

    if (!paymentId) {
      return { reconocido: false, proveedor: this.proveedor, error: 'No se encontró ID de pago en payload ni query' };
    }

    // 🔒 REGLAS ESTRICTAS DE SEGURIDAD HMAC:
    // Si la empresa tiene configurado webhookSecret en la BD, exigimos y validamos la firma digital
    if (webhookSecret) {
      const xSignature = (headers['x-signature'] || headers['X-Signature']) as string | undefined;
      const xRequestId = (headers['x-request-id'] || headers['X-Request-Id']) as string | undefined;

      const validacion = this.validarFirmaHmac(
        webhookSecret,
        xSignature || '',
        xRequestId || '',
        String(paymentId),
      );

      if (!validacion.valida) {
        this.logger.warn(`Webhook Mercado Pago descartado por fallo HMAC: ${validacion.error}`);
        return {
          reconocido: false,
          proveedor: this.proveedor,
          error: `Firma HMAC inválida: ${validacion.error}`,
        };
      }
      this.logger.log(`Webhook Mercado Pago verificado exitosamente mediante HMAC-SHA256 para pago ${paymentId}`);
    } else {
      this.logger.warn(
        `Webhook Mercado Pago recibido sin webhookSecret configurado. Se verificará autenticidad consultando la API de MP directamente con Access Token.`,
      );
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
