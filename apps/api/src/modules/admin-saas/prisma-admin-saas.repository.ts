import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { AdminCapacidad, AdminPago, AdminSaasMetrics, AdminSaasRepository } from './admin-saas.repository.js';

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
      ),
      -- Las empresas demo (propias, de prueba) y las dadas de baja no cuentan para el negocio.
      reales AS (SELECT id, created_at FROM empresas WHERE deleted_at IS NULL AND NOT es_demo),
      suscripciones AS (SELECT s.* FROM suscripciones s JOIN reales r ON r.id = s.empresa_id)
      SELECT
        COALESCE((
          SELECT SUM(pl.precio_ars) FROM suscripciones s JOIN planes pl ON pl.id = s.plan_id
          WHERE s.estado = 'activa' AND COALESCE(pl.precio_ars, 0) > 0
        ), 0) AS mrr,
        (SELECT COUNT(*) FROM reales) AS total_empresas,
        (SELECT COUNT(*) FROM suscripciones WHERE estado = 'activa') AS activas,
        (SELECT COUNT(*) FROM suscripciones WHERE estado = 'periodo_prueba') AS en_prueba,
        (SELECT COUNT(*) FROM suscripciones WHERE estado IN ('vencida', 'pendiente_pago')) AS vencidas,
        (SELECT COUNT(*) FROM reales, mes WHERE created_at >= mes.inicio) AS nuevas_este_mes,
        (SELECT COUNT(*) FROM reales, mes WHERE created_at >= mes.anterior AND created_at < mes.inicio) AS nuevas_mes_anterior,
        COALESCE((SELECT SUM(monto_ars) FROM pagos, mes WHERE estado = 'confirmado' AND created_at >= mes.inicio AND empresa_id IN (SELECT id FROM reales)), 0) AS pagos_este_mes,
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
      { id: string; empresa_id: string; empresa_nombre: string; monto_ars: string; metodo: string; estado: string; periodo: Date | null; notas: string | null; created_at: Date; plan: string | null; ciclo: string | null; cuota: number | null; cuotas: number | null; grupo_id: string | null; periodo_desde: Date | null; periodo_hasta: Date | null; precio_lista: string | null; descuento_ars: string | null; codigo: string | null; devolucion_motivo: string | null }[]
    >(Prisma.sql`
      SELECT pago.id, pago.empresa_id, e.nombre AS empresa_nombre, pago.monto_ars, pago.metodo, pago.estado, pago.periodo, pago.notas, pago.created_at,
        pago.plan, pago.ciclo, pago.cuota, pago.cuotas, pago.grupo_id, pago.periodo_desde, pago.periodo_hasta, pago.precio_lista, pago.descuento_ars, c.codigo, pago.devolucion_motivo
      FROM pagos AS pago
      JOIN empresas e ON e.id = pago.empresa_id
      LEFT JOIN cupones c ON c.id = pago.cupon_id
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
      plan: f.plan,
      ciclo: f.ciclo,
      cuota: f.cuota,
      cuotas: f.cuotas,
      grupoId: f.grupo_id,
      periodoDesde: f.periodo_desde?.toISOString().slice(0, 10) ?? null,
      periodoHasta: f.periodo_hasta?.toISOString().slice(0, 10) ?? null,
      precioLista: f.precio_lista == null ? null : Number(f.precio_lista),
      descuentoArs: f.descuento_ars == null ? null : Number(f.descuento_ars),
      codigo: f.codigo,
      devolucionMotivo: f.devolucion_motivo,
    }));
  }

}
