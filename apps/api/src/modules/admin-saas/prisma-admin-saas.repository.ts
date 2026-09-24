import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { AdminCapacidad, AdminPago, AdminSaasMetrics, AdminSaasRepository, RegistrarPagoInput, ResultadoPago } from './admin-saas.repository.js';

@Injectable()
export class PrismaAdminSaasRepository implements AdminSaasRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Puerto de admin_saas_metrics() (028_saas_metrics.sql). */
  async metrics(): Promise<AdminSaasMetrics> {
    const filas = await this.prisma.$queryRaw<
      {
        mrr: string;
        total_empresas: bigint;
        activas: bigint;
        en_prueba: bigint;
        vencidas: bigint;
        nuevas_este_mes: bigint;
        nuevas_mes_anterior: bigint;
        pagos_este_mes: string;
        empresas_por_plan: { plan: string; cantidad: number }[];
      }[]
    >(Prisma.sql`
      WITH mes AS (
        SELECT date_trunc('month', CURRENT_DATE)::date AS inicio, date_trunc('month', CURRENT_DATE - interval '1 month')::date AS anterior
      )
      SELECT
        COALESCE((
          SELECT SUM(pl.precio_ars) FROM suscripciones s JOIN planes pl ON pl.id = s.plan_id
          WHERE s.estado = 'activa' AND COALESCE(pl.precio_ars, 0) > 0
        ), 0) AS mrr,
        (SELECT COUNT(*) FROM empresas WHERE deleted_at IS NULL) AS total_empresas,
        (SELECT COUNT(*) FROM suscripciones WHERE estado = 'activa') AS activas,
        (SELECT COUNT(*) FROM suscripciones WHERE estado = 'periodo_prueba') AS en_prueba,
        (SELECT COUNT(*) FROM suscripciones WHERE estado IN ('vencida', 'pendiente_pago')) AS vencidas,
        (SELECT COUNT(*) FROM empresas, mes WHERE created_at >= mes.inicio AND deleted_at IS NULL) AS nuevas_este_mes,
        (SELECT COUNT(*) FROM empresas, mes WHERE created_at >= mes.anterior AND created_at < mes.inicio AND deleted_at IS NULL) AS nuevas_mes_anterior,
        COALESCE((SELECT SUM(monto_ars) FROM pagos, mes WHERE estado = 'confirmado' AND created_at >= mes.inicio), 0) AS pagos_este_mes,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('plan', ep.plan, 'cantidad', ep.cantidad) ORDER BY ep.cantidad DESC)
          FROM (
            SELECT pl.nombre AS plan, COUNT(*)::int AS cantidad
            FROM suscripciones s JOIN planes pl ON pl.id = s.plan_id
            WHERE s.estado IN ('activa', 'periodo_prueba')
            GROUP BY pl.nombre
          ) ep
        ), '[]'::jsonb) AS empresas_por_plan
    `);
    const f = filas[0];
    if (!f) {
      return { mrr: 0, totalEmpresas: 0, activas: 0, enPrueba: 0, vencidas: 0, nuevasEsteMes: 0, nuevasMesAnterior: 0, pagosEsteMes: 0, empresasPorPlan: [] };
    }
    return {
      mrr: Number(f.mrr),
      totalEmpresas: Number(f.total_empresas),
      activas: Number(f.activas),
      enPrueba: Number(f.en_prueba),
      vencidas: Number(f.vencidas),
      nuevasEsteMes: Number(f.nuevas_este_mes),
      nuevasMesAnterior: Number(f.nuevas_mes_anterior),
      pagosEsteMes: Number(f.pagos_este_mes),
      empresasPorPlan: f.empresas_por_plan,
    };
  }

  /** Puerto de admin_capacidad() (044_admin_capacidad.sql) - sin el campo `tablas` (diagnóstico de infra, sin consumidor real). */
  async capacidad(): Promise<AdminCapacidad> {
    const inicioMes = Prisma.sql`date_trunc('month', CURRENT_DATE)`;
    const filas = await this.prisma.$queryRaw<
      { ventas: bigint; productos: bigint; clientes: bigint; movimientos: bigint; empresas: bigint; registros_mes: bigint }[]
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM ventas) AS ventas,
        (SELECT COUNT(*) FROM productos) AS productos,
        (SELECT COUNT(*) FROM clientes) AS clientes,
        (SELECT COUNT(*) FROM movimientos_inventario) AS movimientos,
        (SELECT COUNT(*) FROM empresas WHERE deleted_at IS NULL) AS empresas,
        (
          (SELECT COUNT(*) FROM ventas WHERE fecha >= ${inicioMes})
          + (SELECT COUNT(*) FROM productos WHERE created_at >= ${inicioMes})
          + (SELECT COUNT(*) FROM clientes WHERE created_at >= ${inicioMes})
          + (SELECT COUNT(*) FROM movimientos_inventario WHERE fecha >= ${inicioMes})
        ) AS registros_mes
    `);
    const f = filas[0];
    if (!f) return { ventas: 0, productos: 0, clientes: 0, movimientos: 0, empresas: 0, totalRegistros: 0, registrosUltimoMes: 0 };
    const ventas = Number(f.ventas);
    const productos = Number(f.productos);
    const clientes = Number(f.clientes);
    const movimientos = Number(f.movimientos);
    return {
      ventas,
      productos,
      clientes,
      movimientos,
      empresas: Number(f.empresas),
      totalRegistros: ventas + productos + clientes + movimientos,
      registrosUltimoMes: Number(f.registros_mes),
    };
  }

  /** Puerto de admin_listar_pagos() (025_admin_saas.sql). */
  async listarPagos(estado: string | null, periodo: string | null): Promise<AdminPago[]> {
    const periodoDate = periodo ? new Date(`${periodo}-01T00:00:00`) : null;
    const filas = await this.prisma.$queryRaw<
      { id: string; empresa_id: string; empresa_nombre: string; monto_ars: string; metodo: string; estado: string; periodo: Date | null; notas: string | null; created_at: Date }[]
    >(Prisma.sql`
      SELECT pago.id, pago.empresa_id, e.nombre AS empresa_nombre, pago.monto_ars, pago.metodo, pago.estado, pago.periodo, pago.notas, pago.created_at
      FROM pagos AS pago
      JOIN empresas e ON e.id = pago.empresa_id
      WHERE (${estado}::text IS NULL OR ${estado}::text = '' OR pago.estado = ${estado}::text)
        AND (${periodoDate}::date IS NULL OR date_trunc('month', COALESCE(pago.periodo, pago.created_at::date)) = date_trunc('month', ${periodoDate}::date))
      ORDER BY pago.created_at DESC
    `);
    return filas.map((f) => ({
      id: f.id,
      empresaId: f.empresa_id,
      empresaNombre: f.empresa_nombre,
      montoArs: Number(f.monto_ars),
      metodo: f.metodo,
      estado: f.estado,
      periodo: f.periodo?.toISOString().slice(0, 7) ?? null,
      notas: f.notas,
      createdAt: f.created_at.toISOString(),
    }));
  }

  /** Puerto de admin_registrar_pago() (025_admin_saas.sql): registra el pago Y extiende la suscripción de la empresa. */
  async registrarPago(input: RegistrarPagoInput): Promise<ResultadoPago> {
    if (!(input.monto > 0)) return { ok: false, motivo: 'monto_invalido' };
    const metodo = input.metodo.trim();
    if (!metodo) return { ok: false, motivo: 'metodo_invalido' };

    const empresa = await this.prisma.empresa.findUnique({ where: { id: input.empresaId }, select: { id: true } });
    if (!empresa) return { ok: false, motivo: 'empresa_invalida' };

    const inicioMes = new Date(`${input.periodo}-01T00:00:00`);
    inicioMes.setDate(1);
    const finMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);

    const pago = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.pago.create({
        data: { empresaId: input.empresaId, montoArs: input.monto, metodo, estado: 'confirmado', periodo: inicioMes, notas: input.notas?.trim() || null },
      });
      const suscripciones = await tx.suscripcion.findMany({ where: { empresaId: input.empresaId }, select: { id: true, fechaVencimiento: true } });
      for (const s of suscripciones) {
        const nuevoVencimiento = !s.fechaVencimiento || finMes > s.fechaVencimiento ? finMes : s.fechaVencimiento;
        await tx.suscripcion.update({ where: { id: s.id }, data: { estado: 'activa', fechaVencimiento: nuevoVencimiento } });
      }
      return creado;
    });
    return { ok: true, id: pago.id };
  }
}
