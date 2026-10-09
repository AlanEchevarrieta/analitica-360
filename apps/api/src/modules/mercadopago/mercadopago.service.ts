import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CobrosService } from '../alianzas/cobros.service.js';
import { PLANES, type CicloFacturacion, type PlanPagoId } from '../planes/planes.util.js';
import { MercadoPagoCliente } from './mercadopago.cliente.js';
import { ESTADOS_ACTIVOS, MESES_MP, referenciaPago } from './mercadopago.util.js';

const NOMBRE_CICLO: Record<CicloFacturacion, string> = { mensual: 'mensual', trimestral: 'trimestral', anual: 'anual' };

/**
 * Débito automático de los planes de Analítica 360 con Mercado Pago (suscripciones "preapproval").
 * Cada cobro que avisa Mercado Pago se registra con CobrosService.registrar, el mismo camino que un
 * cobro manual (cupón, cuotas, referidos, comisión de la cámara y vencimiento de la suscripción).
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger('MercadoPago');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoCliente,
    private readonly cobros: CobrosService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async estado(empresaId: string) {
    const s = await this.prisma.mercadoPagoSuscripcion.findUnique({ where: { empresaId } });
    return {
      disponible: this.mp.configurado,
      suscripcion: s ? { estado: s.estado, plan: s.plan, ciclo: s.ciclo, monto: Number(s.monto), urlAutorizar: s.estado === 'pending' ? s.urlAutorizar : null } : null,
    };
  }

  /** Crea la suscripción en Mercado Pago y devuelve adónde mandar al cliente para autorizar su tarjeta. */
  async activar(empresaId: string, usuario: UsuarioContext, plan: PlanPagoId, ciclo: CicloFacturacion): Promise<{ url: string }> {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede activar el débito automático');
    if (!this.mp.configurado) throw new ServiceUnavailableException('El pago con Mercado Pago todavía no está disponible');
    const actual = await this.prisma.mercadoPagoSuscripcion.findUnique({ where: { empresaId } });
    if (actual?.estado === 'authorized') throw new ConflictException('Ya tenés el débito automático activo. Cancelalo para cambiar de plan.');
    // Una pendiente (sin autorizar) se reemplaza: puede haber elegido otro plan.
    if (actual?.estado === 'pending') await this.mp.cancelar(actual.preapprovalId).catch((e) => this.logger.warn(`No se pudo cancelar la suscripción pendiente: ${String(e)}`));

    const propuesta = await this.cobros.proponer({ empresaId, plan, ciclo });
    const s = await this.mp.crearSuscripcion({
      motivo: `Analítica 360 · Plan ${PLANES[plan].nombre} ${NOMBRE_CICLO[ciclo]}`,
      referencia: empresaId,
      email: usuario.email,
      meses: MESES_MP[ciclo],
      monto: propuesta.monto,
      volverA: `${this.config.get('APP_URL_PUBLICA', { infer: true })}/planes?mp=volvio`,
    });
    if (!s.init_point) throw new ServiceUnavailableException('Mercado Pago no devolvió el link para autorizar el pago');
    const datos = { preapprovalId: s.id, estado: s.status ?? 'pending', plan, ciclo, monto: new Prisma.Decimal(propuesta.monto), urlAutorizar: s.init_point };
    await this.prisma.mercadoPagoSuscripcion.upsert({ where: { empresaId }, create: { empresaId, ...datos }, update: datos });
    return { url: s.init_point };
  }

  async cancelar(empresaId: string, usuario: UsuarioContext) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede cancelar el débito automático');
    const s = await this.prisma.mercadoPagoSuscripcion.findUnique({ where: { empresaId } });
    if (!s || !ESTADOS_ACTIVOS.includes(s.estado)) throw new NotFoundException('No hay débito automático activo');
    await this.mp.cancelar(s.preapprovalId);
    await this.prisma.mercadoPagoSuscripcion.update({ where: { empresaId }, data: { estado: 'cancelled' } });
  }

  /** Aviso (webhook) de Mercado Pago ya verificado. Devuelve qué hizo, para el registro. */
  async procesarAviso(tipo: string, id: string): Promise<string> {
    if (tipo === 'subscription_preapproval') {
      const p = await this.mp.suscripcion(id);
      const r = await this.prisma.mercadoPagoSuscripcion.updateMany({ where: { preapprovalId: p.id }, data: { estado: p.status } });
      return r.count ? `suscripción ${p.id}: ${p.status}` : `suscripción ${p.id} desconocida`;
    }
    if (tipo !== 'subscription_authorized_payment') return `aviso ${tipo} ignorado`;

    const ap = await this.mp.pagoAutorizado(id);
    const s = await this.prisma.mercadoPagoSuscripcion.findUnique({ where: { preapprovalId: ap.preapproval_id } });
    if (!s) return `pago ${ap.id} de una suscripción desconocida`;
    if (ap.payment?.status !== 'approved') return `pago ${ap.id}: ${ap.payment?.status ?? ap.status}, sin registrar`;
    const referencia = referenciaPago(ap.id);
    if (await this.prisma.pago.findFirst({ where: { origen: 'mercadopago', referenciaExterna: referencia }, select: { id: true } })) return `pago ${ap.id} ya registrado`;

    const plan = s.plan as PlanPagoId;
    const ciclo = s.ciclo as CicloFacturacion;
    try {
      await this.cobros.registrar({
        empresaId: s.empresaId,
        plan,
        ciclo,
        metodo: 'mercadopago',
        origen: 'mercadopago',
        referenciaExterna: referencia,
        monto: Number(ap.transaction_amount),
        fechaCobro: ap.date_created?.slice(0, 10),
        notas: 'Débito automático de Mercado Pago',
      });
    } catch (e) {
      // Dos avisos del mismo pago a la vez: el índice único deja pasar uno solo.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return `pago ${ap.id} ya registrado`;
      throw e;
    }

    // El próximo período puede costar distinto (fin del descuento de entrada, premios por referidos…).
    const proxima = await this.cobros.proponer({ empresaId: s.empresaId, plan, ciclo });
    if (Math.abs(proxima.monto - Number(s.monto)) >= 0.01) {
      await this.mp.cambiarMonto(s.preapprovalId, proxima.monto);
      await this.prisma.mercadoPagoSuscripcion.update({ where: { id: s.id }, data: { monto: new Prisma.Decimal(proxima.monto) } });
    }
    await this.prisma.mercadoPagoSuscripcion.update({ where: { id: s.id }, data: { estado: 'authorized' } });
    return `pago ${ap.id} registrado`;
  }
}
