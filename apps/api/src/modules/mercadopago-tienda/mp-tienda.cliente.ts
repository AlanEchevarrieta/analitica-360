import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import type { PagoMp } from './mp-tienda.util.js';

const API = 'https://api.mercadopago.com';

export interface TokensMp {
  accessToken: string;
  refreshToken: string;
  publicKey: string | null;
  userId: string;
  /** Segundos. */
  expiresIn: number;
}

export interface Preferencia {
  id: string;
  initPoint: string;
}

/** Mercado Pago con la cuenta de cada comercio (OAuth y Checkout Pro). Se reemplaza en las pruebas. */
@Injectable()
export class MpTiendaCliente {
  private readonly logger = new Logger('MercadoPagoTiendas');

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configurado(): boolean {
    return Boolean(this.config.get('MP_CLIENT_ID', { infer: true }) && this.config.get('MP_CLIENT_SECRET', { infer: true }));
  }

  private async pedir<T>(metodo: 'GET' | 'POST', ruta: string, token: string | null, cuerpo?: unknown): Promise<T> {
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    }).catch((e) => {
      this.logger.warn(`Mercado Pago no respondió (${ruta}): ${String(e)}`);
      throw new ServiceUnavailableException('Mercado Pago no responde en este momento. Probá de nuevo en unos minutos.');
    });
    const texto = await r.text();
    if (!r.ok) {
      this.logger.warn(`Mercado Pago ${metodo} ${ruta} respondió ${r.status}: ${texto.slice(0, 300)}`);
      if (r.status === 400 || r.status === 401) throw new BadRequestException('Mercado Pago rechazó el pedido: puede que haya que volver a conectar la cuenta');
      throw new ServiceUnavailableException('Mercado Pago no respondió bien. Probá de nuevo en un rato.');
    }
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  private credencialesApp() {
    return { client_id: this.config.get('MP_CLIENT_ID', { infer: true }), client_secret: this.config.get('MP_CLIENT_SECRET', { infer: true }) };
  }

  private leerTokens(r: { access_token: string; refresh_token: string; public_key?: string; user_id: number | string; expires_in?: number }): TokensMp {
    return { accessToken: r.access_token, refreshToken: r.refresh_token, publicKey: r.public_key ?? null, userId: String(r.user_id), expiresIn: Number(r.expires_in ?? 15_552_000) };
  }

  async intercambiar(code: string, verificador: string, redirectUri: string): Promise<TokensMp> {
    return this.leerTokens(await this.pedir('POST', '/oauth/token', null, { ...this.credencialesApp(), grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verificador }));
  }

  async renovar(refreshToken: string): Promise<TokensMp> {
    return this.leerTokens(await this.pedir('POST', '/oauth/token', null, { ...this.credencialesApp(), grant_type: 'refresh_token', refresh_token: refreshToken }));
  }

  async crearPreferencia(
    token: string,
    datos: { titulo: string; total: number; referencia: string; email: string | null; nombre: string | null; avisos: string; volverA: string },
  ): Promise<Preferencia> {
    const r = await this.pedir<{ id: string; init_point: string }>('POST', '/checkout/preferences', token, {
      items: [{ id: datos.referencia, title: datos.titulo, quantity: 1, unit_price: datos.total, currency_id: 'ARS' }],
      payer: { ...(datos.email ? { email: datos.email } : {}), ...(datos.nombre ? { name: datos.nombre } : {}) },
      external_reference: datos.referencia,
      notification_url: datos.avisos,
      back_urls: { success: datos.volverA, pending: datos.volverA, failure: datos.volverA },
      auto_return: 'approved',
    });
    return { id: r.id, initPoint: r.init_point };
  }

  pago(token: string, id: string): Promise<PagoMp> {
    return this.pedir<PagoMp>('GET', `/v1/payments/${encodeURIComponent(id)}`, token);
  }
}
