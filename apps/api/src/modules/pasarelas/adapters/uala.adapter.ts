import { Injectable, Logger } from '@nestjs/common';
import type {
  CobroGeneradoResult,
  CrearCobroInput,
  DetallePagoResult,
  ProveedorPasarela,
  WebhookEventoResult,
} from '../pasarelas.types.js';
import type { PasarelaAdapter } from './pasarela.adapter.interface.js';

interface UalaTokenCache {
  token: string;
  expiraEn: number;
}

@Injectable()
export class UalaAdapter implements PasarelaAdapter {
  readonly proveedor: ProveedorPasarela = 'uala';
  private readonly logger = new Logger('UalaAdapter');
  private tokenCache = new Map<string, UalaTokenCache>();

  private async obtenerToken(credenciales: Record<string, string>): Promise<string> {
    // Si el usuario configuró directamente un token estático
    if (credenciales.token) return credenciales.token;

    const { userName, clientId, clientSecret, ambiente = 'prod' } = credenciales;
    if (!userName || !clientId || !clientSecret) {
      throw new Error('Faltan credenciales de Ualá Bis (userName, clientId o clientSecret)');
    }

    const cacheKey = `${userName}_${clientId}`;
    const enCache = this.tokenCache.get(cacheKey);
    if (enCache && enCache.expiraEn > Date.now() + 60_000) {
      return enCache.token;
    }

    const authHost =
      ambiente === 'stage' ? 'https://auth.stage.ualabis.com.ar' : 'https://auth.prod.ualabis.com.ar';

    const res = await fetch(`${authHost}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: userName,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      this.logger.error(`Error autenticando con Ualá Bis: ${res.status} ${err}`);
      throw new Error('No se pudo autenticar con Ualá Bis');
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache.set(cacheKey, {
      token: data.access_token,
      expiraEn: Date.now() + (data.expires_in || 1800) * 1000,
    });

    return data.access_token;
  }

  async crearCobro(
    credenciales: Record<string, string>,
    input: CrearCobroInput,
    webhookUrlBase: string,
  ): Promise<CobroGeneradoResult> {
    const token = await this.obtenerToken(credenciales);
    const { ambiente = 'prod', userName } = credenciales;
    const apiHost =
      ambiente === 'stage' ? 'https://api.stage.ualabis.com.ar' : 'https://api.prod.ualabis.com.ar';

    const body = {
      amount: input.monto.toFixed(2),
      description: input.concepto.slice(0, 150),
      userName: userName || credenciales.clientId,
      callback_fail: input.urlVuelta,
      callback_success: input.urlVuelta,
      notification_url: `${webhookUrlBase}/pasarelas/webhook/uala`,
    };

    const res = await fetch(`${apiHost}/v2/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      this.logger.error(`Error al crear orden en Ualá Bis: ${res.status} ${err}`);
      throw new Error('Error al generar cobro con Ualá Bis');
    }

    const data = (await res.json()) as {
      uuid?: string;
      order_id?: string;
      links?: { checkoutLink?: string };
    };

    const idExterno = data.order_id || data.uuid || `uala_${Date.now()}`;
    const urlPago = data.links?.checkoutLink;

    if (!urlPago) {
      throw new Error('Ualá Bis no devolvió link de pago');
    }

    const comision = Math.round(input.monto * 0.035 * 1.21 * 100) / 100; // ~3.5% + IVA

    return {
      idExterno,
      urlPago,
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
    const token = await this.obtenerToken(credenciales);
    const { ambiente = 'prod' } = credenciales;
    const apiHost =
      ambiente === 'stage' ? 'https://api.stage.ualabis.com.ar' : 'https://api.prod.ualabis.com.ar';

    const res = await fetch(`${apiHost}/v2/orders/${idExterno}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return { idExterno, estado: 'pendiente', monto: 0 };
    }

    const data = (await res.json()) as { status: string; amount: string | number };
    const st = String(data.status).toUpperCase();

    const estadoMap: Record<string, 'aprobado' | 'rechazado' | 'pendiente' | 'expirado'> = {
      PAID: 'aprobado',
      APPROVED: 'aprobado',
      REJECTED: 'rechazado',
      FAILED: 'rechazado',
      EXPIRED: 'expirado',
      PENDING: 'pendiente',
    };

    return {
      idExterno,
      estado: estadoMap[st] ?? 'pendiente',
      monto: Number(data.amount || 0),
      pagadoEn: st === 'PAID' || st === 'APPROVED' ? new Date() : null,
    };
  }

  async procesarWebhook(
    credenciales: Record<string, string>,
    _webhookSecret: string | null,
    payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookEventoResult> {
    const p = payload as Record<string, unknown> | undefined;
    const orderId = (p?.order_id as string) || (p?.uuid as string);
    const rawStatus = String(p?.status || '').toUpperCase();

    if (!orderId) {
      return { reconocido: false, proveedor: this.proveedor };
    }

    if (rawStatus === 'PAID' || rawStatus === 'APPROVED') {
      return {
        reconocido: true,
        proveedor: this.proveedor,
        idExterno: orderId,
        estadoNuevo: 'aprobado',
        montoPagado: Number(p?.amount || 0),
        pagadoEn: new Date(),
      };
    }

    if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
      return {
        reconocido: true,
        proveedor: this.proveedor,
        idExterno: orderId,
        estadoNuevo: 'rechazado',
      };
    }

    if (rawStatus === 'EXPIRED') {
      return {
        reconocido: true,
        proveedor: this.proveedor,
        idExterno: orderId,
        estadoNuevo: 'expirado',
      };
    }

    // Si el payload viene incompleto, consultamos a la API directamente
    try {
      const detalle = await this.consultarPago(credenciales, orderId);
      return {
        reconocido: true,
        proveedor: this.proveedor,
        idExterno: orderId,
        estadoNuevo: detalle.estado,
        montoPagado: detalle.monto,
        pagadoEn: detalle.pagadoEn ?? new Date(),
      };
    } catch (e) {
      return {
        reconocido: false,
        proveedor: this.proveedor,
        error: e instanceof Error ? e.message : 'Error procesando webhook Ualá',
      };
    }
  }
}
