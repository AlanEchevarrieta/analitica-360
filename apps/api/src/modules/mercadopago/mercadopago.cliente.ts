import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';

const API = 'https://api.mercadopago.com';

export interface Preapproval {
  id: string;
  status: string;
  init_point?: string;
  external_reference?: string;
  auto_recurring?: { transaction_amount?: number; frequency?: number; frequency_type?: string };
}

export interface AuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status: string;
  transaction_amount: number;
  date_created?: string;
  payment?: { id?: number | string; status?: string } | null;
}

/** Llamadas a la API de Mercado Pago (suscripciones). Se reemplaza en las pruebas. */
@Injectable()
export class MercadoPagoCliente {
  private readonly logger = new Logger('MercadoPago');

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configurado(): boolean {
    return Boolean(this.config.get('MP_ACCESS_TOKEN', { infer: true }));
  }

  private async pedir<T>(metodo: 'GET' | 'POST' | 'PUT', ruta: string, cuerpo?: unknown): Promise<T> {
    const token = this.config.get('MP_ACCESS_TOKEN', { infer: true });
    if (!token) throw new ServiceUnavailableException('Mercado Pago no está configurado todavía');
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await r.text();
    if (!r.ok) {
      this.logger.warn(`Mercado Pago ${metodo} ${ruta} respondió ${r.status}: ${texto.slice(0, 300)}`);
      throw new ServiceUnavailableException('Mercado Pago no respondió bien. Probá de nuevo en un rato.');
    }
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  crearSuscripcion(datos: { motivo: string; referencia: string; email: string; meses: number; monto: number; volverA: string }) {
    return this.pedir<Preapproval>('POST', '/preapproval', {
      reason: datos.motivo,
      external_reference: datos.referencia,
      payer_email: datos.email,
      back_url: datos.volverA,
      status: 'pending',
      auto_recurring: { frequency: datos.meses, frequency_type: 'months', transaction_amount: datos.monto, currency_id: 'ARS' },
    });
  }

  suscripcion(id: string) {
    return this.pedir<Preapproval>('GET', `/preapproval/${encodeURIComponent(id)}`);
  }

  cambiarMonto(id: string, monto: number) {
    return this.pedir<Preapproval>('PUT', `/preapproval/${encodeURIComponent(id)}`, { auto_recurring: { transaction_amount: monto, currency_id: 'ARS' } });
  }

  cancelar(id: string) {
    return this.pedir<Preapproval>('PUT', `/preapproval/${encodeURIComponent(id)}`, { status: 'cancelled' });
  }

  pagoAutorizado(id: string) {
    return this.pedir<AuthorizedPayment>('GET', `/authorized_payments/${encodeURIComponent(id)}`);
  }
}
