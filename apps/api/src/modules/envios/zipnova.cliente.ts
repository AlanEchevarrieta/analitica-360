import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import type { ItemZipnova } from './envios.util.js';

export interface Credenciales {
  token: string;
  secreto: string;
}

export interface Destino {
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  street_number?: string;
  street_extras?: string;
  city: string;
  state: string;
  zipcode: string;
}

export interface EnvioZipnova {
  id: number;
  status: string | null;
  carrier: string | null;
  /** Número del correo (si ya lo asignó) o el de Zipnova. */
  seguimiento: string | null;
}

/** Habla con la API v2 de Zipnova con las credenciales de cada empresa. Se reemplaza en las pruebas. */
@Injectable()
export class ZipnovaCliente {
  private readonly logger = new Logger('Zipnova');

  constructor(private readonly config: ConfigService<Env, true>) {}

  private async pedir<T>(cred: Credenciales, metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown, binario = false): Promise<T> {
    const r = await fetch(`${this.config.get('ZIPNOVA_URL', { infer: true })}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Basic ${Buffer.from(`${cred.token}:${cred.secreto}`).toString('base64')}`,
        Accept: 'application/json',
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    }).catch((e) => {
      this.logger.warn(`Zipnova no respondió (${ruta}): ${String(e)}`);
      throw new ServiceUnavailableException('El servicio de envíos no responde. Probá de nuevo en unos minutos.');
    });
    if (r.status === 401 || r.status === 403) throw new BadRequestException('Zipnova rechazó las credenciales: revisá el token y el secreto en Configuración → Envíos');
    if (!r.ok) {
      const texto = (await r.text()).slice(0, 400);
      this.logger.warn(`Zipnova ${r.status} en ${ruta}: ${texto}`);
      let mensaje = '';
      try {
        const j = JSON.parse(texto) as { message?: string; errors?: Record<string, string[]> };
        mensaje = j.message ?? Object.values(j.errors ?? {}).flat()[0] ?? '';
      } catch {
        /* sin cuerpo JSON */
      }
      throw new BadRequestException(`Zipnova no aceptó el pedido${mensaje ? `: ${mensaje}` : ''}`);
    }
    return (binario ? Buffer.from(await r.arrayBuffer()) : await r.json()) as T;
  }

  /** Que las credenciales sirvan para esa cuenta. */
  async verificar(cred: Credenciales, cuentaId: number): Promise<{ nombre: string | null }> {
    const c = await this.pedir<{ id?: number; name?: string }>(cred, 'GET', `/accounts/${cuentaId}`);
    return { nombre: c?.name ?? null };
  }

  cotizar(cred: Credenciales, datos: { cuentaId: number; origenId: number | null; valor: number; destino: Destino; items: ItemZipnova[] }): Promise<unknown> {
    return this.pedir(cred, 'POST', '/shipments/quote', {
      account_id: datos.cuentaId,
      ...(datos.origenId ? { origin_id: datos.origenId } : {}),
      source: 'analitica360',
      declared_value: datos.valor,
      type_packaging: 'dynamic',
      sort_by: 'price',
      destination: { city: datos.destino.city, state: datos.destino.state, zipcode: datos.destino.zipcode },
      items: datos.items,
    });
  }

  async crear(
    cred: Credenciales,
    datos: { cuentaId: number; origenId: number | null; referencia: string; valor: number; destino: Destino; items: ItemZipnova[]; carrierId: number; servicio: string; logistica: string },
  ): Promise<EnvioZipnova> {
    const r = await this.pedir<Record<string, unknown>>(cred, 'POST', '/shipments', {
      account_id: datos.cuentaId,
      ...(datos.origenId ? { origin_id: String(datos.origenId) } : {}),
      external_id: datos.referencia,
      source: 'analitica360',
      declared_value: datos.valor,
      type_packaging: 'dynamic',
      carrier_id: datos.carrierId,
      service_type: datos.servicio,
      logistic_type: datos.logistica,
      destination: datos.destino,
      items: datos.items,
    });
    return leerEnvio(r);
  }

  async envio(cred: Credenciales, id: string): Promise<EnvioZipnova> {
    return leerEnvio(await this.pedir<Record<string, unknown>>(cred, 'GET', `/shipments/${encodeURIComponent(id)}`));
  }

  /** La etiqueta en PDF (sin cambiar el estado del envío en Zipnova). */
  etiqueta(cred: Credenciales, id: string): Promise<Buffer> {
    return this.pedir<Buffer>(cred, 'GET', `/shipments/${encodeURIComponent(id)}/label.pdf?no_status_change=1`, undefined, true);
  }
}

function leerEnvio(r: Record<string, unknown>): EnvioZipnova {
  const carrier = r.carrier as { name?: string } | undefined;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    id: Number(r.id),
    status: texto(r.status),
    carrier: texto(carrier?.name),
    seguimiento: texto(r.carrier_tracking_id) ?? texto(r.delivery_id),
  };
}
