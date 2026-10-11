import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BcraInflacionClient } from '../analytics/bcra-inflacion.client.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { INFLACION_INDEC } from '../analytics/inflacion.util.js';
import { PLANES, PLANES_PAGOS, idPlan, type PlanPagoId } from './planes.util.js';
import {
  aplicarPorcentaje,
  emailAumento,
  inflacionAcumulada,
  precioEnFecha,
  preciosEnFecha,
  primeraFechaPosible,
  rigeDesde,
  sumarDiasFecha,
  type CambioPrecio,
  type FilaPrecio,
} from './precios.util.js';

type Db = Prisma.TransactionClient | PrismaService;
const fecha = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

export interface ProgramarAumentoInput {
  vigenteDesde: string;
  /** Aumento parejo para los tres planes… */
  porcentaje?: number;
  /** …o el precio nuevo de cada plan (los que no vienen, no cambian). */
  precios?: Partial<Record<PlanPagoId, number>>;
  motivo?: string;
}

/**
 * Precios de lista con fecha (aumentos por IPC): los lee el cobro, la tabla de
 * precios de la app y la landing; la consola programa los aumentos y un
 * proceso diario avisa por email a los clientes con 30 días de anticipación.
 */
@Injectable()
export class PreciosPlanService {
  private readonly logger = new Logger('Precios');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly bcra: BcraInflacionClient,
  ) {}

  private async filas(db: Db = this.prisma): Promise<(FilaPrecio & { id: string; motivo: string | null; avisados: number })[]> {
    const f = await db.precioPlan.findMany({ orderBy: [{ vigenteDesde: 'asc' }, { plan: 'asc' }] });
    return f.map((x) => ({ id: x.id, plan: x.plan, precioMensual: Number(x.precioMensual), vigenteDesde: fecha(x.vigenteDesde)!, avisadoEl: fecha(x.avisoEnviadoEn), motivo: x.motivo, avisados: x.avisados }));
  }

  /** Precio de lista por mes de un plan en una fecha (por defecto, hoy). */
  async mensual(plan: PlanPagoId, enFecha: string = fechaHoyAR(), db: Db = this.prisma): Promise<number> {
    return precioEnFecha(await this.filas(db), plan, enFecha);
  }

  /** Precios de lista por mes de los tres planes en una fecha (por defecto, hoy). */
  async mensuales(enFecha: string = fechaHoyAR()): Promise<Record<PlanPagoId, number>> {
    return preciosEnFecha(await this.filas(), enFecha);
  }

  /** Lo que ve la landing: los precios de hoy y, si hay, el próximo aumento ya avisado. */
  async publicos() {
    const hoy = fechaHoyAR();
    const filas = await this.filas();
    const proximo = filas.map((f) => ({ f, desde: rigeDesde(f) })).filter((x) => x.desde && x.desde > hoy).sort((a, b) => a.desde!.localeCompare(b.desde!))[0];
    return {
      precios: preciosEnFecha(filas, hoy),
      proximo: proximo ? { desde: proximo.desde!, precios: preciosEnFecha(filas, proximo.desde!) } : null,
    };
  }

  /** Consola: precios de hoy, aumentos programados, historial y una sugerencia según el IPC. */
  async panel() {
    const hoy = fechaHoyAR();
    const filas = await this.filas();
    const actuales = preciosEnFecha(filas, hoy);
    const programados = filas
      .filter((f) => { const d = rigeDesde(f); return !d || d > hoy; })
      .map((f) => ({ id: f.id, plan: f.plan, nombre: PLANES[f.plan as PlanPagoId]?.nombre ?? f.plan, precioMensual: f.precioMensual, antes: precioEnFecha(filas, f.plan as PlanPagoId, sumarDiasFecha(f.vigenteDesde, -1)), vigenteDesde: f.vigenteDesde, rigeDesde: rigeDesde(f), avisadoEl: f.avisadoEl, avisados: f.avisados, motivo: f.motivo }));
    const historial = filas
      .filter((f) => { const d = rigeDesde(f); return d && d <= hoy; })
      // Lo más nuevo primero y, en la misma fecha, en el orden de los planes.
      .sort((a, b) => rigeDesde(b)!.localeCompare(rigeDesde(a)!) || PLANES_PAGOS.indexOf(a.plan as PlanPagoId) - PLANES_PAGOS.indexOf(b.plan as PlanPagoId))
      .map((f) => ({ id: f.id, plan: f.plan, nombre: PLANES[f.plan as PlanPagoId]?.nombre ?? f.plan, precioMensual: f.precioMensual, rigeDesde: rigeDesde(f), motivo: f.motivo }));
    return {
      hoy,
      primeraFechaPosible: primeraFechaPosible(hoy),
      actuales: PLANES_PAGOS.map((p) => ({ plan: p, nombre: PLANES[p].nombre, precioMensual: actuales[p] })),
      programados,
      historial,
      ipc: await this.sugerenciaIpc(hoy),
      emailConfigurado: Boolean(this.config.get('RESEND_API_KEY', { infer: true })),
    };
  }

  /** Inflación de los últimos 3 meses publicados (tabla del INDEC + API del BCRA para los más nuevos). */
  private async sugerenciaIpc(hoy: string): Promise<{ meses: { mes: string; valor: number }[]; acumulada: number } | null> {
    const datos: Record<string, number> = { ...INFLACION_INDEC };
    const desde = `${sumarDiasFecha(hoy, -200).slice(0, 7)}-01`;
    const bcra = await this.bcra.inflacionDesdeBcra(desde, hoy).catch(() => null);
    if (bcra) Object.assign(datos, bcra);
    const meses = Object.keys(datos).sort().slice(-3).map((mes) => ({ mes, valor: datos[mes] }));
    if (meses.length < 3) return null;
    return { meses, acumulada: inflacionAcumulada(meses.map((m) => m.valor)) };
  }

  /** Programa un aumento. Tiene que ser al menos 30 días después de hoy, para poder avisar a tiempo. */
  async programar(input: ProgramarAumentoInput, creadoPor: string | null) {
    const hoy = fechaHoyAR();
    const minimo = primeraFechaPosible(hoy);
    if (input.vigenteDesde < minimo) throw new BadRequestException(`El aumento tiene que regir desde el ${minimo} o después: hay que avisar a los clientes con 30 días de anticipación.`);
    if ((input.porcentaje == null) === (input.precios == null)) throw new BadRequestException('Indicá un porcentaje o los precios nuevos de cada plan.');

    const filas = await this.filas();
    const antes = preciosEnFecha(filas, input.vigenteDesde);
    const nuevos: Partial<Record<PlanPagoId, number>> =
      input.porcentaje != null ? Object.fromEntries(PLANES_PAGOS.map((p) => [p, aplicarPorcentaje(antes[p], input.porcentaje!)])) : input.precios!;
    const cambios = PLANES_PAGOS.filter((p) => nuevos[p] != null && nuevos[p] !== antes[p]);
    if (cambios.length === 0) throw new BadRequestException('Los precios nuevos son iguales a los de esa fecha: no hay nada que cambiar.');
    if (filas.some((f) => f.vigenteDesde === input.vigenteDesde && cambios.includes(f.plan as PlanPagoId))) {
      throw new ConflictException('Ya hay un cambio de precio programado para esa fecha. Cancelalo primero si querés reemplazarlo.');
    }
    const motivo = input.motivo?.trim() || (input.porcentaje != null ? `Actualización por IPC (${input.porcentaje.toLocaleString('es-AR')} %)` : 'Actualización de precios');
    await this.prisma.precioPlan.createMany({
      data: cambios.map((plan) => ({ plan, precioMensual: new Prisma.Decimal(nuevos[plan]!), vigenteDesde: new Date(`${input.vigenteDesde}T00:00:00Z`), motivo, creadoPor })),
    });
    // El aviso sale en el momento si el email está configurado; si no, lo reintenta el proceso diario.
    await this.avisarPendientes().catch((e) => this.logger.warn(`Aviso de precios: ${(e as Error).message}`));
    return this.panel();
  }

  /** Cancela un aumento que todavía no rige. Si ya se había avisado, se manda un email aclarando. */
  async cancelar(id: string) {
    const f = await this.prisma.precioPlan.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('No encontramos ese cambio de precio');
    const desde = rigeDesde({ vigenteDesde: fecha(f.vigenteDesde)!, avisadoEl: fecha(f.avisoEnviadoEn) });
    if (desde && desde <= fechaHoyAR()) throw new BadRequestException('Ese precio ya rige: para bajarlo, programá un cambio nuevo.');
    await this.prisma.precioPlan.delete({ where: { id } });
    return this.panel();
  }

  /**
   * Manda el aviso de los aumentos todavía no avisados (uno por fecha) a los
   * dueños y administradores de cada empresa en prueba o con plan activo.
   * Sin la clave de Resend no hace nada: se reintenta en la próxima vuelta y
   * el precio se corre solo para respetar los 30 días.
   */
  async avisarPendientes(): Promise<number> {
    const clave = this.config.get('RESEND_API_KEY', { infer: true });
    if (!clave) return 0;
    const hoy = fechaHoyAR();
    const filas = await this.filas();
    const pendientes = filas.filter((f) => !f.avisadoEl);
    if (pendientes.length === 0) return 0;

    const empresas = await this.prisma.empresa.findMany({
      where: { deletedAt: null, suscripciones: { some: { estado: { in: ['activa', 'periodo_prueba', 'pendiente_pago'] } } } },
      select: {
        id: true,
        nombre: true,
        suscripciones: { orderBy: { createdAt: 'desc' }, take: 1, select: { estado: true, plan: { select: { nombre: true } } } },
        usuarios: { where: { rolCrudo: { in: ['dueno', 'administrador'] }, activo: true, deletedAt: null }, select: { email: true } },
      },
    });
    const urlPlanes = `${this.config.get('APP_URL_PUBLICA', { infer: true }).replace(/\/$/, '')}/planes`;
    let enviados = 0;
    for (const vigenteDesde of [...new Set(pendientes.map((f) => f.vigenteDesde))].sort()) {
      const delDia = pendientes.filter((f) => f.vigenteDesde === vigenteDesde);
      // Si el aviso sale hoy, rige como mínimo dentro de 30 días.
      const desde = rigeDesde({ vigenteDesde, avisadoEl: hoy })!;
      const cambios: CambioPrecio[] = delDia.map((f) => ({ plan: f.plan as PlanPagoId, nombre: PLANES[f.plan as PlanPagoId]?.nombre ?? f.plan, antes: precioEnFecha(filas, f.plan as PlanPagoId, sumarDiasFecha(desde, -1)), despues: f.precioMensual }));
      let enviadosDia = 0;
      for (const e of empresas) {
        const s = e.suscripciones[0];
        const plan = s && s.estado !== 'periodo_prueba' ? idPlan(s.plan?.nombre) : null;
        const contenido = emailAumento({ empresa: e.nombre, vigenteDesde: desde, cambios, motivo: delDia[0].motivo, planActual: plan === 'starter' ? null : (plan as PlanPagoId | null), urlPlanes });
        for (const para of new Set(e.usuarios.map((u) => u.email.trim().toLowerCase()).filter((x) => x.includes('@')))) {
          if (await this.mandar(clave, para, contenido)) enviadosDia++;
        }
      }
      await this.prisma.precioPlan.updateMany({ where: { id: { in: delDia.map((f) => f.id) } }, data: { avisoEnviadoEn: new Date(`${hoy}T12:00:00Z`), avisados: enviadosDia } });
      this.logger.log(`Aviso de precios del ${desde}: ${enviadosDia} emails`);
      enviados += enviadosDia;
    }
    return enviados;
  }

  private async mandar(clave: string, para: string, c: { asunto: string; texto: string; html: string }): Promise<boolean> {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.config.get('AVISOS_EMAIL_DESDE', { infer: true }), to: [para], subject: c.asunto, text: c.texto, html: c.html }),
      });
      if (!r.ok) this.logger.warn(`Resend respondió ${r.status} al avisar precios a ${para}`);
      return r.ok;
    } catch (e) {
      this.logger.warn(`No se pudo avisar precios a ${para}: ${String(e)}`);
      return false;
    }
  }

  /** Deja `planes.precio_ars` con el precio de hoy (lo usa la consola para el ingreso mensual estimado). */
  async sincronizarTablaPlanes(): Promise<void> {
    const hoy = await this.mensuales();
    for (const p of PLANES_PAGOS) {
      await this.prisma.plan.updateMany({ where: { nombre: p, NOT: { precioArs: new Prisma.Decimal(hoy[p]) } }, data: { precioArs: new Prisma.Decimal(hoy[p]) } });
    }
  }
}
