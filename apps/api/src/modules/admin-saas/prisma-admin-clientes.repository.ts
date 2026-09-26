import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { diaAR } from '../analytics/fecha-sql.js';
import type { AdminEmpresaDetalle, AdminEmpresaFila, AdminEvolucionMes, AdminTablaTamano } from './admin-clientes.types.js';

type FilaEmpresaSql = {
  id: string;
  nombre: string;
  es_demo: boolean;
  alta: string;
  baja: string | null;
  suscripcion_id: string | null;
  plan: string | null;
  precio_plan: string | null;
  estado: string | null;
  vencimiento: string | null;
  usuarios: bigint;
  productos: bigint;
  ventas30: bigint;
  monto30: string;
  monto_previo30: string;
  ultima_venta: string | null;
  tickets_abiertos: bigint;
  pagado_total: string;
  ultimo_pago: string | null;
};

const MONTO_VENTA = Prisma.sql`COALESCE(v.total_con_interes, v.total_sin_interes, 0)`;

function aFila(f: FilaEmpresaSql): AdminEmpresaFila {
  return {
    id: f.id,
    nombre: f.nombre,
    esDemo: f.es_demo,
    alta: f.alta,
    baja: f.baja,
    suscripcionId: f.suscripcion_id,
    plan: f.plan,
    precioPlan: Number(f.precio_plan ?? 0),
    estado: f.estado,
    vencimiento: f.vencimiento,
    usuarios: Number(f.usuarios),
    productos: Number(f.productos),
    ventas30: Number(f.ventas30),
    monto30: Number(f.monto30),
    montoPrevio30: Number(f.monto_previo30),
    ultimaVenta: f.ultima_venta,
    ticketsAbiertos: Number(f.tickets_abiertos),
    pagadoTotal: Number(f.pagado_total),
    ultimoPago: f.ultimo_pago,
  };
}

/** Consultas cross-tenant de la consola (gateadas por @RequireAdminApp() en el controller). */
@Injectable()
export class PrismaAdminClientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async empresas(soloId?: string): Promise<AdminEmpresaFila[]> {
    const filas = await this.prisma.$queryRaw<FilaEmpresaSql[]>(Prisma.sql`
      SELECT
        e.id, e.nombre, e.es_demo,
        ${diaAR(Prisma.raw('e.created_at'))}::text AS alta,
        CASE WHEN e.deleted_at IS NULL THEN NULL ELSE ${diaAR(Prisma.raw('e.deleted_at'))}::text END AS baja,
        s.id AS suscripcion_id, pl.nombre AS plan, pl.precio_ars AS precio_plan, s.estado, s.fecha_vencimiento::text AS vencimiento,
        (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id) AS usuarios,
        (SELECT COUNT(*) FROM productos p WHERE p.empresa_id = e.id AND p.deleted_at IS NULL) AS productos,
        (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = e.id AND v.deleted_at IS NULL AND v.fecha >= now() - interval '30 days') AS ventas30,
        (SELECT COALESCE(SUM(${MONTO_VENTA}), 0) FROM ventas v WHERE v.empresa_id = e.id AND v.deleted_at IS NULL AND v.fecha >= now() - interval '30 days') AS monto30,
        (SELECT COALESCE(SUM(${MONTO_VENTA}), 0) FROM ventas v WHERE v.empresa_id = e.id AND v.deleted_at IS NULL
           AND v.fecha >= now() - interval '60 days' AND v.fecha < now() - interval '30 days') AS monto_previo30,
        (SELECT ${diaAR(Prisma.raw('MAX(v.fecha)'))}::text FROM ventas v WHERE v.empresa_id = e.id AND v.deleted_at IS NULL) AS ultima_venta,
        (SELECT COUNT(*) FROM tickets t WHERE t.empresa_id = e.id AND t.deleted_at IS NULL AND t.estado IN ('abierto', 'en_proceso')) AS tickets_abiertos,
        (SELECT COALESCE(SUM(pg.monto_ars), 0) FROM pagos pg WHERE pg.empresa_id = e.id AND pg.estado = 'confirmado') AS pagado_total,
        (SELECT ${diaAR(Prisma.raw('MAX(pg.created_at)'))}::text FROM pagos pg WHERE pg.empresa_id = e.id AND pg.estado = 'confirmado') AS ultimo_pago
      FROM empresas e
      LEFT JOIN LATERAL (
        SELECT s.* FROM suscripciones s WHERE s.empresa_id = e.id
        ORDER BY s.fecha_vencimiento DESC NULLS LAST LIMIT 1
      ) s ON true
      LEFT JOIN planes pl ON pl.id = s.plan_id
      WHERE ${soloId ?? null}::uuid IS NULL OR e.id = ${soloId ?? null}::uuid
      ORDER BY e.deleted_at IS NOT NULL, e.created_at DESC
    `);
    return filas.map(aFila);
  }

  async evolucion(): Promise<AdminEvolucionMes[]> {
    const filas = await this.prisma.$queryRaw<
      { mes: string; altas: bigint; bajas: bigint; clientes: bigint; clientes_activos: bigint; cobrado: string; ventas: bigint; monto: string }[]
    >(Prisma.sql`
      WITH meses AS (
        SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month')::date AS mes
      ),
      -- Alta efectiva: la fecha de carga o la primera venta si es anterior (clientes migrados con historia).
      reales AS (
        SELECT e.id, e.deleted_at,
               LEAST(e.created_at, COALESCE((SELECT MIN(v.fecha) FROM ventas v WHERE v.empresa_id = e.id AND v.deleted_at IS NULL), e.created_at)) AS created_at
        FROM empresas e WHERE NOT e.es_demo
      ),
      ventas_reales AS (
        SELECT v.empresa_id, date_trunc('month', ${diaAR(Prisma.raw('v.fecha'))})::date AS mes, ${MONTO_VENTA} AS monto
        FROM ventas v JOIN reales r ON r.id = v.empresa_id
        WHERE v.deleted_at IS NULL AND v.fecha >= date_trunc('month', CURRENT_DATE) - interval '12 months'
      )
      SELECT
        to_char(m.mes, 'YYYY-MM') AS mes,
        (SELECT COUNT(*) FROM reales r WHERE date_trunc('month', r.created_at)::date = m.mes) AS altas,
        (SELECT COUNT(*) FROM reales r WHERE r.deleted_at IS NOT NULL AND date_trunc('month', r.deleted_at)::date = m.mes) AS bajas,
        (SELECT COUNT(*) FROM reales r WHERE r.created_at < m.mes + interval '1 month' AND (r.deleted_at IS NULL OR r.deleted_at >= m.mes + interval '1 month')) AS clientes,
        (SELECT COUNT(DISTINCT vr.empresa_id) FROM ventas_reales vr WHERE vr.mes = m.mes) AS clientes_activos,
        (SELECT COALESCE(SUM(pg.monto_ars), 0) FROM pagos pg JOIN reales r ON r.id = pg.empresa_id
           WHERE pg.estado = 'confirmado' AND date_trunc('month', COALESCE(pg.periodo, pg.created_at::date))::date = m.mes) AS cobrado,
        (SELECT COUNT(*) FROM ventas_reales vr WHERE vr.mes = m.mes) AS ventas,
        (SELECT COALESCE(SUM(vr.monto), 0) FROM ventas_reales vr WHERE vr.mes = m.mes) AS monto
      FROM meses m
      ORDER BY m.mes
    `);
    return filas.map((f) => ({
      mes: f.mes,
      altas: Number(f.altas),
      bajas: Number(f.bajas),
      clientes: Number(f.clientes),
      clientesActivos: Number(f.clientes_activos),
      cobrado: Number(f.cobrado),
      ventas: Number(f.ventas),
      montoVendido: Number(f.monto),
    }));
  }

  async detalle(id: string): Promise<Omit<AdminEmpresaDetalle, 'empresa'> | null> {
    const existe = await this.prisma.empresa.findUnique({ where: { id }, select: { id: true } });
    if (!existe) return null;
    const [ventasPorMes, usuarios, pagos, tickets, historial, uso] = await Promise.all([
      this.prisma.$queryRaw<{ mes: string; ventas: bigint; monto: string }[]>(Prisma.sql`
        WITH meses AS (
          SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month')::date AS mes
        )
        SELECT to_char(m.mes, 'YYYY-MM') AS mes, COUNT(v.id) AS ventas, COALESCE(SUM(${MONTO_VENTA}), 0) AS monto
        FROM meses m
        LEFT JOIN ventas v ON v.empresa_id = ${id}::uuid AND v.deleted_at IS NULL
          AND date_trunc('month', ${diaAR(Prisma.raw('v.fecha'))})::date = m.mes
        GROUP BY m.mes ORDER BY m.mes
      `),
      this.prisma.$queryRaw<{ nombre: string | null; email: string; rol: string; alta: string }[]>(Prisma.sql`
        SELECT u.nombre, u.email, u.rol::text AS rol, ${diaAR(Prisma.raw('u.created_at'))}::text AS alta
        FROM usuarios u WHERE u.empresa_id = ${id}::uuid ORDER BY u.created_at
      `),
      this.prisma.$queryRaw<{ id: string; monto_ars: string; metodo: string; estado: string; periodo: string | null; notas: string | null; fecha: string }[]>(Prisma.sql`
        SELECT pg.id, pg.monto_ars, pg.metodo, pg.estado, to_char(pg.periodo, 'YYYY-MM') AS periodo, pg.notas, ${diaAR(Prisma.raw('pg.created_at'))}::text AS fecha
        FROM pagos pg WHERE pg.empresa_id = ${id}::uuid ORDER BY pg.created_at DESC
      `),
      this.prisma.$queryRaw<{ id: string; numero_ticket: string | null; asunto: string; estado: string; prioridad: string; fecha: string }[]>(Prisma.sql`
        SELECT t.id, t.numero_ticket, t.asunto, t.estado, t.prioridad, ${diaAR(Prisma.raw('t.created_at'))}::text AS fecha
        FROM tickets t WHERE t.empresa_id = ${id}::uuid AND t.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT 50
      `),
      this.prisma.$queryRaw<{ fecha: string; plan_anterior: string | null; plan_nuevo: string; motivo: string | null }[]>(Prisma.sql`
        SELECT ${diaAR(Prisma.raw('h.fecha_cambio'))}::text AS fecha, h.plan_anterior, h.plan_nuevo, h.motivo
        FROM historial_planes h WHERE h.empresa_id = ${id}::uuid ORDER BY h.fecha_cambio DESC
      `),
      this.prisma.$queryRaw<{ clientes: bigint; compras: bigint; pedidos: bigint; ventas: bigint; primera: string | null }[]>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM clientes c WHERE c.empresa_id = ${id}::uuid) AS clientes,
          (SELECT COUNT(*) FROM compras c WHERE c.empresa_id = ${id}::uuid AND c.deleted_at IS NULL) AS compras,
          (SELECT COUNT(*) FROM pedidos p WHERE p.empresa_id = ${id}::uuid) AS pedidos,
          (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = ${id}::uuid AND v.deleted_at IS NULL) AS ventas,
          (SELECT ${diaAR(Prisma.raw('MIN(v.fecha)'))}::text FROM ventas v WHERE v.empresa_id = ${id}::uuid AND v.deleted_at IS NULL) AS primera
      `),
    ]);
    const u = uso[0];
    return {
      ventasPorMes: ventasPorMes.map((v) => ({ mes: v.mes, ventas: Number(v.ventas), monto: Number(v.monto) })),
      usuarios,
      pagos: pagos.map((p) => ({ id: p.id, montoArs: Number(p.monto_ars), metodo: p.metodo, estado: p.estado, periodo: p.periodo, notas: p.notas, fecha: p.fecha })),
      tickets: tickets.map((t) => ({ id: t.id, numeroTicket: t.numero_ticket, asunto: t.asunto, estado: t.estado, prioridad: t.prioridad, fecha: t.fecha })),
      historialPlanes: historial.map((h) => ({ fecha: h.fecha, planAnterior: h.plan_anterior, planNuevo: h.plan_nuevo, motivo: h.motivo })),
      uso: { clientes: Number(u?.clientes ?? 0), compras: Number(u?.compras ?? 0), pedidos: Number(u?.pedidos ?? 0), ventasTotales: Number(u?.ventas ?? 0), primeraVenta: u?.primera ?? null },
    };
  }

  /** Tamaño real de la base de datos y de las tablas más pesadas. */
  async tamanoBase(): Promise<{ bytes: number; tablas: AdminTablaTamano[] }> {
    const [total, tablas] = await Promise.all([
      this.prisma.$queryRaw<{ bytes: bigint }[]>(Prisma.sql`SELECT pg_database_size(current_database()) AS bytes`),
      this.prisma.$queryRaw<{ tabla: string; bytes: bigint; filas: bigint }[]>(Prisma.sql`
        SELECT c.relname AS tabla, pg_total_relation_size(c.oid) AS bytes, GREATEST(c.reltuples, 0)::bigint AS filas
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE '\\_prisma%'
        ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 8
      `),
    ]);
    return { bytes: Number(total[0]?.bytes ?? 0), tablas: tablas.map((t) => ({ tabla: t.tabla, bytes: Number(t.bytes), filas: Number(t.filas) })) };
  }
}
