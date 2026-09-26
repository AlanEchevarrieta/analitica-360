import { perdidasPorDia } from '../inventario/perdidas.sql.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { sumarDiasIso } from '../analytics/analytics.util.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { dineroDevolucionesPorDia } from '../analytics/devoluciones-dinero.js';
import type {
  CrearMovimientoFinancieroInput,
  DeudaProveedor,
  EstadosContablesRepository,
  MovimientoFinanciero,
} from './estados-contables.repository.js';
import type { CompraDato, MontoDia, MovimientoFinancieroDato, SeniaDato, TipoMovimientoFinanciero } from './estados-contables.util.js';

/** Primer instante del día siguiente a `fecha` en AR: todo lo anterior es "hasta el cierre de ese día". */
const finDelDia = (fecha: string) => new Date(`${sumarDiasIso(fecha, 1)}T00:00:00.000-03:00`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

type FilaMovimiento = Prisma.MovimientoFinancieroGetPayload<{ include: { proveedor: { select: { nombre: true } } } }>;

function toMovimiento(m: FilaMovimiento): MovimientoFinanciero {
  return {
    id: m.id,
    tipo: m.tipo as TipoMovimientoFinanciero,
    monto: m.monto.toNumber(),
    fecha: iso(m.fecha),
    descripcion: m.descripcion,
    proveedorId: m.proveedorId,
    proveedorNombre: m.proveedor?.nombre ?? null,
    vidaUtilMeses: m.vidaUtilMeses,
    conCaja: m.conCaja,
  };
}

@Injectable()
export class PrismaEstadosContablesRepository implements EstadosContablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ventasPorDia(empresaId: string, hasta: string) {
    const filas = await this.prisma.$queryRaw<{ fecha: string; ingreso: string; cogs: string; ventas: bigint }[]>(Prisma.sql`
      -- Primero por venta (el total de la venta una sola vez) y después por día.
      SELECT t.fecha::text, SUM(t.total) AS ingreso, SUM(t.cogs) AS cogs, COUNT(*) AS ventas FROM (
        SELECT ${diaAR(Prisma.raw('v.fecha'))} AS fecha, COALESCE(v.total_con_interes, 0) AS total,
               COALESCE(SUM(vi.cantidad * vi.costo_unitario), 0) AS cogs
        FROM ventas v
        LEFT JOIN ventas_items vi ON vi.venta_id = v.id
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.fecha < ${finDelDia(hasta)}
        GROUP BY v.id
      ) t
      GROUP BY t.fecha
    `);
    return filas.map((f) => ({ fecha: f.fecha, ingreso: Number(f.ingreso), cogs: Number(f.cogs), ventas: Number(f.ventas) }));
  }

  devolucionesPorDia(empresaId: string, hasta: string) {
    return dineroDevolucionesPorDia(this.prisma, empresaId, new Date('2000-01-01T00:00:00.000-03:00'), finDelDia(hasta));
  }

  async cobrosPorDia(empresaId: string, hasta: string): Promise<MontoDia[]> {
    const fin = finDelDia(hasta);
    const filas = await this.prisma.$queryRaw<{ fecha: string; monto: string }[]>(Prisma.sql`
      SELECT fecha::text, SUM(monto) AS monto FROM (
        -- Al vender: la seña o el total.
        SELECT ${diaAR(Prisma.raw('v.fecha'))} AS fecha,
               CASE WHEN v.es_senia THEN v.monto_senia ELSE COALESCE(v.total_con_interes, 0) END AS monto
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.fecha < ${fin}
        UNION ALL
        -- El saldo de una seña, el día que se terminó de cobrar (si se cobró en partes, lo cobrado).
        SELECT ${diaAR(Prisma.raw('COALESCE(v.fecha_cobro_saldo, v.fecha)'))},
               COALESCE(v.total_con_interes, 0) - v.monto_senia - v.saldo_pendiente
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.es_senia
          AND COALESCE(v.fecha_cobro_saldo, v.fecha) < ${fin}
      ) t
      GROUP BY fecha
      HAVING SUM(monto) <> 0
    `);
    return filas.map((f) => ({ fecha: f.fecha, monto: Number(f.monto) }));
  }

  async senias(empresaId: string, hasta: string): Promise<SeniaDato[]> {
    const filas = await this.prisma.$queryRaw<{ fecha: string; total: string; monto_senia: string; saldo: string; fecha_cobro: string | null }[]>(Prisma.sql`
      SELECT ${diaAR(Prisma.raw('v.fecha'))}::text AS fecha,
             COALESCE(v.total_con_interes, 0) AS total, v.monto_senia, v.saldo_pendiente AS saldo,
             CASE WHEN v.fecha_cobro_saldo IS NULL THEN NULL ELSE ${diaAR(Prisma.raw('v.fecha_cobro_saldo'))}::text END AS fecha_cobro
      FROM ventas v
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.es_senia AND v.fecha < ${finDelDia(hasta)}
    `);
    return filas.map((f) => ({
      fecha: f.fecha,
      total: Number(f.total),
      montoSenia: Number(f.monto_senia),
      saldoPendiente: Number(f.saldo),
      fechaCobroSaldo: f.fecha_cobro,
    }));
  }

  async compras(empresaId: string, hasta: string): Promise<CompraDato[]> {
    const compras = await this.prisma.compra.findMany({
      where: { empresaId, deletedAt: null, fecha: { lte: new Date(hasta) } },
      select: { fecha: true, totalReal: true, total: true, aCredito: true },
    });
    return compras.map((c) => ({ fecha: iso(c.fecha), monto: c.totalReal.toNumber() || (c.total?.toNumber() ?? 0), aCredito: c.aCredito }));
  }

  async movimientosDatos(empresaId: string, hasta: string): Promise<MovimientoFinancieroDato[]> {
    const movs = await this.prisma.movimientoFinanciero.findMany({
      where: { empresaId, deletedAt: null, fecha: { lte: new Date(hasta) } },
      select: { tipo: true, monto: true, fecha: true, vidaUtilMeses: true, conCaja: true, createdAt: true },
    });
    return movs.map((m) => ({
      tipo: m.tipo as TipoMovimientoFinanciero,
      monto: m.monto.toNumber(),
      fecha: iso(m.fecha),
      vidaUtilMeses: m.vidaUtilMeses,
      conCaja: m.conCaja,
      creado: m.createdAt.toISOString(),
    }));
  }

  async valorStockAl(empresaId: string, fecha: string): Promise<number> {
    // Mismo criterio que la valorización de Contabilidad (solo stock positivo, costo del producto),
    // pero con las unidades que había a esa fecha. La mercadería de una compra cuenta desde la
    // fecha de la compra (la misma que usa la caja): el legacy cargaba compras viejas con
    // movimientos de stock fechados el día de la carga.
    const filas = await this.prisma.$queryRaw<{ valor: string }[]>(Prisma.sql`
      SELECT COALESCE(SUM(s.stock * COALESCE(p.costo, 0)), 0) AS valor
      FROM (
        SELECT m.producto_id, SUM(m.cantidad * m.signo) AS stock
        FROM movimientos_inventario m
        LEFT JOIN compras c ON m.tipo = 'compra' AND c.id = m.referencia_id
        WHERE m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL
          AND COALESCE(c.fecha, ${diaAR(Prisma.raw('m.fecha'))}) <= ${fecha}::date
        GROUP BY m.producto_id
      ) s
      -- El producto también tiene que ser de la empresa: hay movimientos migrados del sistema
      -- anterior que apuntan a productos de otra empresa y no deben sumar.
      JOIN productos p ON p.id = s.producto_id AND p.empresa_id = ${empresaId}::uuid AND p.deleted_at IS NULL
      WHERE s.stock > 0
    `);
    return Number(filas[0]?.valor ?? 0);
  }

  perdidasPorDia(empresaId: string, hasta: string): Promise<MontoDia[]> {
    return perdidasPorDia(this.prisma, empresaId, '2000-01-01', hasta);
  }

  async deudaPorProveedor(empresaId: string, hasta: string): Promise<DeudaProveedor[]> {
    const filas = await this.prisma.$queryRaw<{ proveedor_id: string | null; nombre: string; comprado: string; pagado: string }[]>(Prisma.sql`
      SELECT t.proveedor_id, COALESCE(p.nombre, t.nombre_libre, 'Sin proveedor') AS nombre,
             SUM(t.comprado) AS comprado, SUM(t.pagado) AS pagado
      FROM (
        SELECT c.proveedor_id, c.proveedor AS nombre_libre, COALESCE(NULLIF(c.total_real, 0), c.total, 0) AS comprado, 0 AS pagado
        FROM compras c
        WHERE c.empresa_id = ${empresaId}::uuid AND c.deleted_at IS NULL AND c.a_credito AND c.fecha <= ${hasta}::date
        UNION ALL
        SELECT m.proveedor_id, NULL, 0, m.monto
        FROM movimientos_financieros m
        WHERE m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL AND m.tipo = 'pago_proveedor' AND m.fecha <= ${hasta}::date
      ) t
      LEFT JOIN proveedores p ON p.id = t.proveedor_id
      GROUP BY t.proveedor_id, COALESCE(p.nombre, t.nombre_libre, 'Sin proveedor')
      HAVING SUM(t.comprado) - SUM(t.pagado) <> 0
      ORDER BY SUM(t.comprado) - SUM(t.pagado) DESC
    `);
    return filas.map((f) => {
      const comprado = Number(f.comprado);
      const pagado = Number(f.pagado);
      return { proveedorId: f.proveedor_id, nombre: f.nombre, comprado, pagado, saldo: comprado - pagado };
    });
  }

  async listarMovimientos(empresaId: string, desde: string, hasta: string): Promise<MovimientoFinanciero[]> {
    const movs = await this.prisma.movimientoFinanciero.findMany({
      where: { empresaId, deletedAt: null, fecha: { gte: new Date(desde), lte: new Date(hasta) } },
      include: { proveedor: { select: { nombre: true } } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
    return movs.map(toMovimiento);
  }

  async crearMovimiento(input: CrearMovimientoFinancieroInput) {
    if (input.proveedorId) {
      const proveedor = await this.prisma.proveedor.findFirst({ where: { id: input.proveedorId, empresaId: input.empresaId } });
      if (!proveedor) return { ok: false as const, motivo: 'proveedor_invalido' as const };
    }
    const m = await this.prisma.movimientoFinanciero.create({
      data: {
        empresaId: input.empresaId,
        usuarioId: input.usuarioId,
        tipo: input.tipo,
        monto: input.monto,
        fecha: new Date(input.fecha),
        descripcion: input.descripcion.trim(),
        proveedorId: input.proveedorId,
        vidaUtilMeses: input.vidaUtilMeses,
        conCaja: input.conCaja,
      },
      include: { proveedor: { select: { nombre: true } } },
    });
    return { ok: true as const, movimiento: toMovimiento(m) };
  }

  async anularMovimiento(empresaId: string, id: string) {
    const m = await this.prisma.movimientoFinanciero.findFirst({ where: { id, empresaId } });
    if (!m) return { ok: false as const, motivo: 'no_encontrado' as const };
    const { count } = await this.prisma.movimientoFinanciero.updateMany({ where: { id, empresaId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (count === 0) return { ok: false as const, motivo: 'ya_anulado' as const };
    return { ok: true as const };
  }
}
