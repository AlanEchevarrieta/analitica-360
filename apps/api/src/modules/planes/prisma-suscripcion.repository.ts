import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  EstadoSuscripcion,
  FilaAdminSuscripcion,
  PlanAdmin,
  ResultadoAdmin,
  SuscripcionRepository,
} from './suscripcion.repository.js';
import type { SuscripcionActiva } from './suscripcion.util.js';
import { ordenarPlanesAdmin } from './planes.util.js';

const PLANES_QUE_ACTUALIZAN_EMPRESA = ['starter', 'basico', 'pro', 'premium', 'business'];

function masDias(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
}

@Injectable()
export class PrismaSuscripcionRepository implements SuscripcionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Puerto de mi_suscripcion_activa(): self-healing, crea el trial starter si la empresa no tiene ninguna suscripción. */
  async activa(empresaId: string): Promise<SuscripcionActiva | null> {
    return this.prisma.$transaction(async (tx) => {
      const existe = await tx.suscripcion.findFirst({ where: { empresaId }, select: { id: true } });
      if (!existe) {
        const plan = await tx.plan.findFirst({ where: { nombre: { equals: 'starter', mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } });
        if (plan) {
          await tx.suscripcion.create({
            data: { empresaId, planId: plan.id, estado: 'periodo_prueba', fechaInicio: new Date(), fechaVencimiento: masDias(14) },
          });
        }
      }
      const fila = await tx.suscripcion.findFirst({
        where: { empresaId },
        orderBy: [{ fechaVencimiento: { sort: 'desc', nulls: 'last' } }],
      });
      if (!fila) return null;
      return { id: fila.id, estado: fila.estado, fechaVencimiento: fila.fechaVencimiento?.toISOString().slice(0, 10) ?? null };
    });
  }

  /** Puerto de iniciarPeriodoPrueba() + registrarAceptacionTerminos() (src/lib/suscripcion.ts, JS puro, no RPC). No-op si ya existe una suscripción. */
  async iniciarPrueba(empresaId: string, usuarioId: string, userAgent: string | null): Promise<void> {
    const existe = await this.prisma.suscripcion.findFirst({ where: { empresaId }, select: { id: true } });
    if (existe) return;

    const plan = await this.prisma.plan.findFirst({ where: { nombre: 'starter' } });
    if (!plan) throw new Error('No se encontró el plan starter');

    await this.prisma.suscripcion.create({
      data: { empresaId, planId: plan.id, estado: 'periodo_prueba', fechaInicio: new Date(), fechaVencimiento: masDias(14) },
    });

    const aceptacionExistente = await this.prisma.aceptacionTerminos.findFirst({
      where: { empresaId, usuarioId, version: '1.0' },
    });
    if (!aceptacionExistente) {
      await this.prisma.aceptacionTerminos.create({ data: { empresaId, usuarioId, version: '1.0', userAgent } });
    }
  }

  async listarPlanes(): Promise<PlanAdmin[]> {
    const planes = await this.prisma.plan.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
    return ordenarPlanesAdmin(planes);
  }

  /** Puerto de admin_listar_suscripciones() (027_empresas_demo.sql): DISTINCT ON empresa, última suscripción por created_at. */
  async listarSuscripciones(): Promise<FilaAdminSuscripcion[]> {
    const filas = await this.prisma.$queryRaw<
      { suscripcion_id: string | null; empresa_id: string; empresa_nombre: string; estado: string | null; fecha_vencimiento: Date | null; plan_nombre: string | null; plan_actual: string | null; es_demo: boolean }[]
    >(Prisma.sql`
      SELECT DISTINCT ON (e.id)
        s.id AS suscripcion_id, e.id AS empresa_id, e.nombre AS empresa_nombre, s.estado, s.fecha_vencimiento,
        p.nombre AS plan_nombre, e.plan_actual, COALESCE(e.es_demo, false) AS es_demo
      FROM empresas e
      LEFT JOIN suscripciones s ON s.empresa_id = e.id
      LEFT JOIN planes p ON p.id = s.plan_id
      WHERE e.deleted_at IS NULL
      ORDER BY e.id, s.created_at DESC NULLS LAST
    `);
    return filas.map((f) => ({
      suscripcionId: f.suscripcion_id,
      empresaId: f.empresa_id,
      empresaNombre: f.empresa_nombre,
      estado: f.estado,
      fechaVencimiento: f.fecha_vencimiento?.toISOString().slice(0, 10) ?? null,
      planNombre: f.plan_nombre,
      planActual: f.plan_actual,
      esDemo: f.es_demo,
    }));
  }

  async marcarEmpresaDemo(empresaId: string, esDemo: boolean): Promise<ResultadoAdmin> {
    const { count } = await this.prisma.empresa.updateMany({ where: { id: empresaId, deletedAt: null }, data: { esDemo } });
    if (count === 0) return { ok: false, motivo: 'empresa_invalida' };
    return { ok: true };
  }

  async asignarSuscripcion(empresaId: string, planId: string, fechaVencimiento: string): Promise<ResultadoAdmin> {
    const empresa = await this.prisma.empresa.findFirst({ where: { id: empresaId, deletedAt: null }, select: { id: true } });
    if (!empresa) return { ok: false, motivo: 'empresa_invalida' };

    const plan = await this.prisma.plan.findUnique({ where: { id: planId }, select: { nombre: true } });
    if (!plan) return { ok: false, motivo: 'plan_invalido' };
    let planClave = plan.nombre.toLowerCase();
    if (planClave === 'básico') planClave = 'basico';

    const vencimiento = new Date(`${fechaVencimiento}T00:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const estado: EstadoSuscripcion = vencimiento >= hoy ? 'activa' : 'vencida';

    await this.prisma.$transaction(async (tx) => {
      const ultima = await tx.suscripcion.findFirst({ where: { empresaId }, orderBy: { createdAt: 'desc' } });
      if (!ultima) {
        await tx.suscripcion.create({ data: { empresaId, planId, estado, fechaInicio: new Date(), fechaVencimiento: vencimiento } });
      } else {
        await tx.suscripcion.update({ where: { id: ultima.id }, data: { planId, fechaVencimiento: vencimiento, estado } });
      }
      if (PLANES_QUE_ACTUALIZAN_EMPRESA.includes(planClave)) {
        await tx.empresa.update({ where: { id: empresaId }, data: { planActual: planClave } });
      }
    });
    return { ok: true };
  }

  async cambiarEstadoSuscripcion(suscripcionId: string, estado: EstadoSuscripcion): Promise<ResultadoAdmin> {
    const { count } = await this.prisma.suscripcion.updateMany({ where: { id: suscripcionId }, data: { estado } });
    if (count === 0) return { ok: false, motivo: 'suscripcion_invalida' };
    return { ok: true };
  }
}
