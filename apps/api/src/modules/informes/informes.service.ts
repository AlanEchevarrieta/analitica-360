import { ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import { InformesDatosService } from './informes-datos.service.js';
import { asuntoInforme, htmlInforme, textoInforme } from './informe.email.js';
import { pdfInforme } from './informe.pdf.js';
import {
  ahoraAR,
  destinatarios,
  informePendiente,
  leerTokenBaja,
  periodoCerrado,
  TIPOS_INFORME,
  tokenBaja,
  type Periodo,
  type TipoInforme,
} from './informes.util.js';

/** El mensual es desde Pro; el semanal, en todos los planes. */
export const FUNCION_DE: Record<TipoInforme, string | null> = { semanal: null, mensual: 'informe_mensual' };
const MAX_INTENTOS = 3;

export interface ConfigInformes {
  semanal: boolean;
  mensual: boolean;
  /** Mostrar también los números en dólares. */
  conDolares: boolean;
  emailsExtra: string[];
  /** Los dueños, que lo reciben siempre (salvo que se den de baja desde el email). */
  duenos: string[];
  /** Dueños o extras que se dieron de baja desde el link del email. */
  bajas: { tipo: TipoInforme; email: string }[];
}

@Injectable()
export class InformesService {
  private readonly logger = new Logger('Informes');

  constructor(
    private readonly prisma: PrismaService,
    private readonly datos: InformesDatosService,
    private readonly acceso: AccesoCuentaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // --- Configuración (Configuración → Informes) ---

  async verConfig(empresaId: string): Promise<ConfigInformes> {
    const [c, duenos] = await Promise.all([this.prisma.informesConfig.findUnique({ where: { empresaId } }), this.duenos(empresaId)]);
    return {
      semanal: c?.semanal ?? true,
      mensual: c?.mensual ?? true,
      conDolares: c?.conDolares ?? false,
      emailsExtra: c?.emailsExtra ?? [],
      duenos,
      bajas: (c?.bajas ?? []).map((b) => ({ tipo: b.slice(0, b.indexOf(':')) as TipoInforme, email: b.slice(b.indexOf(':') + 1) })),
    };
  }

  async guardarConfig(empresaId: string, input: { semanal?: boolean; mensual?: boolean; conDolares?: boolean; emailsExtra?: string[]; reactivar?: string }): Promise<ConfigInformes> {
    const actual = await this.prisma.informesConfig.findUnique({ where: { empresaId } });
    const emailsExtra = input.emailsExtra ? [...new Set(input.emailsExtra.map((e) => e.trim().toLowerCase()))] : undefined;
    // "reactivar" saca a ese email de las bajas (volvió a querer recibirlo).
    const bajas = input.reactivar ? (actual?.bajas ?? []).filter((b) => !b.endsWith(`:${input.reactivar!.toLowerCase()}`)) : undefined;
    const datos = { semanal: input.semanal, mensual: input.mensual, conDolares: input.conDolares, emailsExtra, bajas };
    await this.prisma.informesConfig.upsert({ where: { empresaId }, create: { empresaId, ...datos }, update: datos });
    return this.verConfig(empresaId);
  }

  historial(empresaId: string) {
    return this.prisma.informeEnviado.findMany({
      where: { empresaId },
      orderBy: { creadoEn: 'desc' },
      take: 20,
      select: { id: true, tipo: true, desde: true, hasta: true, estado: true, destinatarios: true, error: true, creadoEn: true, enviadoEn: true },
    });
  }

  /** El último período cerrado (el que llegaría por email). */
  ultimoPeriodo(tipo: TipoInforme): Periodo {
    return periodoCerrado(tipo, ahoraAR(new Date()).dia);
  }

  async exigirPlan(empresaId: string, tipo: TipoInforme) {
    const funcion = FUNCION_DE[tipo];
    if (!funcion) return;
    const plan = await this.acceso.planDe(empresaId);
    if (!plan.funciones.includes(funcion)) {
      throw new ForbiddenException({ code: 'plan_insuficiente', funcion, planMinimo: 'pro', message: 'El informe mensual está en el plan Pro' });
    }
  }

  /** PDF del último período cerrado, para verlo o descargarlo desde la app. */
  async pdf(empresaId: string, tipo: TipoInforme): Promise<{ archivo: string; contenido: Buffer }> {
    await this.exigirPlan(empresaId, tipo);
    const p = this.ultimoPeriodo(tipo);
    const d = await this.datos.armar(empresaId, tipo, p);
    return { archivo: nombreArchivo(tipo, p), contenido: await pdfInforme(d) };
  }

  /** "Enviarme uno de prueba": solo a quien lo pide, y no queda como enviado. */
  async enviarPrueba(empresaId: string, tipo: TipoInforme, email: string): Promise<{ para: string }> {
    await this.exigirPlan(empresaId, tipo);
    if (!this.config.get('RESEND_API_KEY', { infer: true })) {
      throw new ServiceUnavailableException('El envío de emails todavía no está configurado. Mientras tanto podés descargar el PDF.');
    }
    const p = this.ultimoPeriodo(tipo);
    const d = await this.datos.armar(empresaId, tipo, p);
    const contenido = await pdfInforme(d);
    await this.mandar(empresaId, tipo, email, d, contenido, nombreArchivo(tipo, p));
    return { para: email };
  }

  // --- Baja desde el email (sin sesión) ---

  async baja(token: string): Promise<{ ok: boolean; empresa?: string; tipo?: TipoInforme }> {
    const t = leerTokenBaja(this.secreto(), token);
    if (!t) return { ok: false };
    const empresa = await this.prisma.empresa.findUnique({ where: { id: t.empresaId }, select: { nombre: true } });
    if (!empresa) return { ok: false };
    const clave = `${t.tipo}:${t.email}`;
    const actual = await this.prisma.informesConfig.findUnique({ where: { empresaId: t.empresaId } });
    if (!actual?.bajas.includes(clave)) {
      await this.prisma.informesConfig.upsert({
        where: { empresaId: t.empresaId },
        create: { empresaId: t.empresaId, bajas: [clave] },
        update: { bajas: { push: clave } },
      });
    }
    return { ok: true, empresa: empresa.nombre, tipo: t.tipo };
  }

  // --- Envío programado ---

  /** Una vuelta del programador: manda lo que toca y reintenta lo que falló. Devuelve cuántos informes procesó. */
  async ciclo(ahora: Date = new Date()): Promise<number> {
    let n = 0;
    for (const tipo of TIPOS_INFORME) {
      const p = informePendiente(tipo, ahora);
      if (!p) continue;
      for (const empresaId of await this.candidatas(tipo, p)) {
        const registro = await this.tomar(empresaId, tipo, p);
        if (!registro) continue;
        n++;
        await this.enviarRegistro(registro, empresaId, tipo, p);
      }
    }
    return n;
  }

  /** Empresas que deberían recibir este informe y todavía no lo tienen enviado. */
  private async candidatas(tipo: TipoInforme, p: Periodo): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT e.id FROM empresas e
      LEFT JOIN informes_config c ON c.empresa_id = e.id
      LEFT JOIN informes_enviados ie ON ie.empresa_id = e.id AND ie.tipo = ${tipo} AND ie.desde = ${p.desde}::date
      WHERE e.deleted_at IS NULL AND e.activo AND NOT e.es_demo
        -- La empresa ya existía cuando terminó el período.
        AND e.created_at < (${p.hasta}::date + 1)
        AND COALESCE(${tipo === 'semanal' ? Prisma.sql`c.semanal` : Prisma.sql`c.mensual`}, true)
        AND (ie.id IS NULL OR (ie.intentos < ${MAX_INTENTOS} AND (ie.estado = 'error' OR (ie.estado = 'enviando' AND ie.creado_en < now() - interval '30 minutes'))))
    `);
    const habilitadas: string[] = [];
    for (const { id } of filas) {
      const [acc, plan] = await Promise.all([this.acceso.de(id), this.acceso.planDe(id)]);
      if (acc.nivel === 'solo_lectura') continue;
      const funcion = FUNCION_DE[tipo];
      if (funcion && !plan.funciones.includes(funcion)) continue;
      habilitadas.push(id);
    }
    return habilitadas;
  }

  /** Reserva el envío (o el reintento): si dos servidores corren a la vez, solo uno lo toma. */
  private async tomar(empresaId: string, tipo: TipoInforme, p: Periodo): Promise<string | null> {
    const nuevo = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO informes_enviados (id, empresa_id, tipo, desde, hasta, estado)
      VALUES (gen_random_uuid(), ${empresaId}::uuid, ${tipo}, ${p.desde}::date, ${p.hasta}::date, 'enviando')
      ON CONFLICT (empresa_id, tipo, desde) DO NOTHING
      RETURNING id
    `);
    if (nuevo[0]) return nuevo[0].id;
    const reintento = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE informes_enviados SET estado = 'enviando', intentos = intentos + 1, creado_en = now(), error = NULL
      WHERE empresa_id = ${empresaId}::uuid AND tipo = ${tipo} AND desde = ${p.desde}::date AND intentos < ${MAX_INTENTOS}
        AND (estado = 'error' OR (estado = 'enviando' AND creado_en < now() - interval '30 minutes'))
      RETURNING id
    `);
    return reintento[0]?.id ?? null;
  }

  private async enviarRegistro(id: string, empresaId: string, tipo: TipoInforme, p: Periodo) {
    try {
      const config = await this.verConfig(empresaId);
      const para = destinatarios(config.duenos, config.emailsExtra, config.bajas.map((b) => `${b.tipo}:${b.email}`), tipo);
      if (!para.length) {
        await this.prisma.informeEnviado.update({ where: { id }, data: { estado: 'sin_destinatarios' } });
        return;
      }
      if (!this.config.get('RESEND_API_KEY', { infer: true })) {
        this.logger.warn(`[sin RESEND_API_KEY] ${tipo} ${p.desde} de ${empresaId} no se mandó (${para.length} destinatarios)`);
        await this.prisma.informeEnviado.update({ where: { id }, data: { estado: 'sin_servicio', destinatarios: para } });
        return;
      }
      const d = await this.datos.armar(empresaId, tipo, p);
      const contenido = await pdfInforme(d);
      const fallidos: string[] = [];
      for (const email of para) {
        try {
          await this.mandar(empresaId, tipo, email, d, contenido, nombreArchivo(tipo, p));
        } catch {
          fallidos.push(email);
        }
      }
      const enviados = para.filter((e) => !fallidos.includes(e));
      await this.prisma.informeEnviado.update({
        where: { id },
        data: enviados.length
          ? { estado: 'enviado', destinatarios: enviados, enviadoEn: new Date(), error: fallidos.length ? `No llegó a: ${fallidos.join(', ')}`.slice(0, 300) : null }
          : { estado: 'error', destinatarios: para, error: 'No se pudo mandar a ningún destinatario' },
      });
    } catch (e) {
      this.logger.error(`Informe ${tipo} ${p.desde} de ${empresaId}: ${(e as Error).message}`);
      await this.prisma.informeEnviado.update({ where: { id }, data: { estado: 'error', error: String((e as Error).message).slice(0, 300) } }).catch(() => {});
    }
  }

  private async mandar(empresaId: string, tipo: TipoInforme, para: string, d: Awaited<ReturnType<InformesDatosService['armar']>>, pdf: Buffer, archivo: string) {
    const urlApp = `${this.urlWeb()}/inicio`;
    const urlBaja = `${this.urlApi()}/informes/baja?t=${encodeURIComponent(tokenBaja(this.secreto(), empresaId, tipo, para))}`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.get('RESEND_API_KEY', { infer: true })}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config.get('AVISOS_EMAIL_DESDE', { infer: true }),
        to: [para],
        subject: asuntoInforme(d),
        html: htmlInforme(d, urlApp, urlBaja),
        text: textoInforme(d, urlApp, urlBaja),
        attachments: [{ filename: archivo, content: pdf.toString('base64') }],
        headers: { 'List-Unsubscribe': `<${urlBaja}>` },
      }),
    });
    if (!r.ok) {
      this.logger.error(`Resend respondió ${r.status} al mandar un informe`);
      throw new ServiceUnavailableException('No se pudo mandar el email. Probá de nuevo en unos minutos.');
    }
  }

  private async duenos(empresaId: string): Promise<string[]> {
    const u = await this.prisma.usuario.findMany({
      where: { empresaId, rolCrudo: { in: ['dueno', 'administrador'] }, activo: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    return [...new Set(u.map((x) => x.email.trim().toLowerCase()).filter((e) => e.includes('@')))];
  }

  private secreto() {
    return this.config.get('CLERK_SECRET_KEY', { infer: true });
  }

  private urlWeb() {
    return this.config.get('CORS_ORIGINS', { infer: true }).split(',')[0].trim().replace(/\/$/, '');
  }

  private urlApi() {
    return (this.config.get('API_URL_PUBLICA', { infer: true }) ?? `http://localhost:${this.config.get('PORT', { infer: true })}`).replace(/\/$/, '');
  }
}

/** "informe-semanal-2026-09-28.pdf" */
export const nombreArchivo = (tipo: TipoInforme, p: Periodo) => `informe-${tipo}-${tipo === 'mensual' ? p.desde.slice(0, 7) : p.desde}.pdf`;
