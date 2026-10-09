import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { firmarCMS } from './arca.firma.js';
import {
  armarTRA,
  leerCAE,
  leerTicketAcceso,
  leerUltimoAutorizado,
  pedidoCAE,
  pedidoDummy,
  pedidoUltimoAutorizado,
  sobreWsaa,
  URLS,
  type Ambiente,
  type DatosComprobante,
  type ResultadoCAE,
} from './arca.util.js';

const pem = (valor: string) => (valor.trimStart().startsWith('-----') ? valor.replace(/\n/g, '\n') : Buffer.from(valor, 'base64').toString('utf8'));

/** Habla con ARCA (WSAA y WSFEv1). Se reemplaza en las pruebas. */
@Injectable()
export class ArcaCliente {
  private readonly logger = new Logger('ARCA');

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  get configurado(): boolean {
    return Boolean(this.config.get('ARCA_CUIT', { infer: true }) && this.config.get('ARCA_CERTIFICADO', { infer: true }) && this.config.get('ARCA_CLAVE', { infer: true }));
  }

  get ambiente(): Ambiente {
    return this.config.get('ARCA_AMBIENTE', { infer: true });
  }

  private url(servicio: 'wsaa' | 'wsfe') {
    return (servicio === 'wsaa' ? this.config.get('ARCA_URL_WSAA', { infer: true }) : this.config.get('ARCA_URL_WSFE', { infer: true })) ?? URLS[this.ambiente][servicio];
  }

  private async soap(url: string, accion: string, cuerpo: string): Promise<string> {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: accion },
      body: cuerpo,
      signal: AbortSignal.timeout(30_000),
    }).catch((e) => {
      this.logger.warn(`ARCA no respondió (${url}): ${String(e)}`);
      throw new ServiceUnavailableException('ARCA no responde en este momento. Probá de nuevo en unos minutos.');
    });
    return r.text();
  }

  /** Token y firma del WSAA: se reutilizan mientras duran (pedir otro antes de que venza da error). */
  private async acceso(): Promise<{ token: string; firma: string }> {
    if (!this.configurado) throw new ServiceUnavailableException('La factura electrónica todavía no está configurada');
    const guardado = await this.prisma.arcaTicket.findUnique({ where: { ambiente: this.ambiente } });
    if (guardado && guardado.vence.getTime() - Date.now() > 10 * 60_000) return guardado;
    const cms = firmarCMS(armarTRA('wsfe'), pem(this.config.get('ARCA_CERTIFICADO', { infer: true })!), pem(this.config.get('ARCA_CLAVE', { infer: true })!));
    const t = leerTicketAcceso(await this.soap(this.url('wsaa'), '', sobreWsaa(cms)));
    await this.prisma.arcaTicket.upsert({ where: { ambiente: this.ambiente }, create: { ambiente: this.ambiente, ...t }, update: t });
    return t;
  }

  /** Servidores de ARCA funcionando (no pide permiso). */
  async funciona(): Promise<boolean> {
    const xml = await this.soap(this.url('wsfe'), 'http://ar.gov.afip.dif.FEV1/FEDummy', pedidoDummy());
    return /<(?:\w+:)?AppServer>OK</.test(xml) && /<(?:\w+:)?DbServer>OK</.test(xml);
  }

  async ultimoAutorizado(cuit: string, puntoVenta: number, tipo: number): Promise<number> {
    const a = await this.acceso();
    return leerUltimoAutorizado(await this.soap(this.url('wsfe'), 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado', pedidoUltimoAutorizado({ ...a, cuit }, puntoVenta, tipo)));
  }

  async solicitarCAE(cuit: string, datos: DatosComprobante): Promise<ResultadoCAE> {
    const a = await this.acceso();
    return leerCAE(await this.soap(this.url('wsfe'), 'http://ar.gov.afip.dif.FEV1/FECAESolicitar', pedidoCAE({ ...a, cuit }, datos)));
  }
}
