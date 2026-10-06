import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { vencimientoDolar, vencimientoTopes, type Vencimiento } from './vencimientos.util.js';

@Injectable()
export class VencimientosService {
  private readonly logger = new Logger('Vencimientos');
  /** Último día en que se avisó cada dato vencido (un email por día como mucho). */
  private avisados = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async estado(hoy: string = fechaHoyAR()): Promise<Vencimiento[]> {
    const [dolar, topes] = await Promise.all([
      // La más atrasada de las tres casas: si una deja de llegar, se ve.
      this.prisma.$queryRaw<{ ultima: string | null }[]>`
        SELECT MIN(ultima)::text AS ultima FROM (SELECT MAX(fecha) AS ultima FROM cotizaciones_dolar GROUP BY casa) x`,
      this.prisma.$queryRaw<{ vigencia: string | null }[]>`
        SELECT MAX(vigencia_desde)::text AS vigencia FROM monotributo_topes WHERE vigencia_desde <= CURRENT_DATE`,
    ]);
    return [vencimientoDolar(dolar[0]?.ultima ?? null, hoy), vencimientoTopes(topes[0]?.vigencia ?? null, hoy)];
  }

  /** Revisa y, si algo está vencido, avisa por email a los administradores (una vez por día por dato). */
  async revisar(): Promise<Vencimiento[]> {
    const hoy = fechaHoyAR();
    const vencidos = (await this.estado(hoy)).filter((v) => v.estado === 'vencido' && this.avisados.get(v.clave) !== hoy);
    if (vencidos.length === 0) return [];
    for (const v of vencidos) this.logger.warn(`${v.titulo}: ${v.detalle}`);
    if (await this.enviarEmail(vencidos)) for (const v of vencidos) this.avisados.set(v.clave, hoy);
    return vencidos;
  }

  private async enviarEmail(vencidos: Vencimiento[]): Promise<boolean> {
    const clave = this.config.get('RESEND_API_KEY', { infer: true });
    if (!clave) return false;
    try {
      const destino = this.config.get('AVISOS_EMAIL', { infer: true });
      const para = destino ? destino.split(',').map((e) => e.trim()) : (await this.prisma.adminEmail.findMany({ select: { email: true } })).map((a) => a.email);
      if (para.length === 0) return false;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.config.get('AVISOS_EMAIL_DESDE', { infer: true }),
          to: para,
          subject: `Analítica 360: ${vencidos.map((v) => v.titulo.toLowerCase()).join(' y ')} sin actualizar`,
          text: [
            ...vencidos.flatMap((v) => [`• ${v.titulo}`, `  ${v.detalle}`, `  Qué hacer: ${v.queHacer}`, '']),
            'Lo ves también en la consola: Sistema → Vencimientos.',
          ].join('\n'),
        }),
      });
      if (!r.ok) this.logger.warn(`Resend respondió ${r.status}`);
      return r.ok;
    } catch (e) {
      this.logger.warn(`No se pudo mandar el aviso de vencimientos: ${String(e)}`);
      return false;
    }
  }
}
