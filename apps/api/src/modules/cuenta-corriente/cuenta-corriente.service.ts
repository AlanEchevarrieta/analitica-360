import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR, fechaLocalAR } from '../analytics/analytics.util.js';
import { aplicarCobro, diasEntre, estadoDeCuenta, tramo, type LineaCuenta, type Tramo } from './cuenta-corriente.util.js';

export interface CobrarInput {
  monto: number;
  formaPago: string;
  fecha: Date;
  notas: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const NOMBRE_PAGO: Record<string, string> = { efectivo: 'efectivo', transferencia: 'transferencia', debito: 'débito', credito: 'crédito', qr: 'Mercado Pago QR' };

@Injectable()
export class CuentaCorrienteService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quién debe, cuánto y desde cuándo (ventas con saldo pendiente). */
  async resumen(empresaId: string) {
    const filas = await this.prisma.$queryRaw<{ cliente_id: string | null; nombre: string; telefono: string | null; fecha: Date; saldo: string }[]>(Prisma.sql`
      SELECT v.cliente_id, COALESCE(c.nombre, NULLIF(v.cliente_nombre, ''), 'Sin cliente') AS nombre, c.telefono, v.fecha, v.saldo_pendiente AS saldo
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = ${empresaId}::uuid
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.saldo_pendiente > 0
    `);
    const hoy = fechaHoyAR();
    const tramos: Record<Tramo, number> = { al_dia: 0, mas_30: 0, mas_60: 0, mas_90: 0 };
    const porCliente = new Map<string, { clienteId: string | null; nombre: string; telefono: string | null; saldo: number; ventas: number; desde: string; tramos: Record<Tramo, number> }>();
    for (const f of filas) {
      const saldo = Number(f.saldo);
      const fecha = fechaLocalAR(f.fecha);
      const t = tramo(diasEntre(fecha, hoy));
      tramos[t] += saldo;
      const k = f.cliente_id ?? `sin:${f.nombre}`;
      const actual = porCliente.get(k) ?? { clienteId: f.cliente_id, nombre: f.nombre, telefono: f.telefono, saldo: 0, ventas: 0, desde: fecha, tramos: { al_dia: 0, mas_30: 0, mas_60: 0, mas_90: 0 } };
      actual.saldo += saldo;
      actual.ventas += 1;
      actual.tramos[t] += saldo;
      if (fecha < actual.desde) actual.desde = fecha;
      porCliente.set(k, actual);
    }
    const deudores = [...porCliente.values()]
      .map((d) => ({ ...d, saldo: r2(d.saldo), dias: diasEntre(d.desde, hoy), tramos: Object.fromEntries(Object.entries(d.tramos).map(([k, v]) => [k, r2(v)])) as Record<Tramo, number> }))
      .sort((a, b) => b.saldo - a.saldo);
    return {
      total: r2(deudores.reduce((a, d) => a + d.saldo, 0)),
      tramos: Object.fromEntries(Object.entries(tramos).map(([k, v]) => [k, r2(v)])) as Record<Tramo, number>,
      deudores,
    };
  }

  /** Resumen de cuenta de un cliente: ventas a cuenta, pagos y saldo. */
  async cuenta(empresaId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, empresaId, deletedAt: null }, select: { id: true, nombre: true, telefono: true } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    const [ventas, cobros] = await Promise.all([
      this.prisma.venta.findMany({
        where: { empresaId, clienteId, deletedAt: null, esSenia: true },
        select: { id: true, numeroVenta: true, fecha: true, totalConInteres: true, totalSinInteres: true, montoSenia: true, saldoPendiente: true, fechaCobroSaldo: true, formaPago: true, cobrosAplicados: { where: { cobro: { anuladoAt: null } }, select: { monto: true } } },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.cobroCliente.findMany({
        where: { empresaId, clienteId },
        include: { aplicaciones: { include: { venta: { select: { numeroVenta: true } } } } },
        orderBy: { fecha: 'asc' },
      }),
    ]);
    const lineas: LineaCuenta[] = [];
    for (const v of ventas) {
      const total = v.totalConInteres?.toNumber() ?? v.totalSinInteres?.toNumber() ?? 0;
      const fecha = fechaLocalAR(v.fecha);
      lineas.push({ fecha, concepto: `Venta ${v.numeroVenta ?? ''}${v.formaPago === 'cuenta_corriente' ? ' (a cuenta)' : ''}`.trim(), debe: total, haber: 0, ventaId: v.id });
      if (v.montoSenia.toNumber() > 0) lineas.push({ fecha, concepto: `Seña de la venta ${v.numeroVenta ?? ''}`.trim(), debe: 0, haber: v.montoSenia.toNumber(), ventaId: v.id });
      // Pagos anteriores a este registro (el sistema viejo guardaba solo el saldo).
      const registrado = v.cobrosAplicados.reduce((a, c) => a + c.monto.toNumber(), 0);
      const previo = r2(total - v.montoSenia.toNumber() - v.saldoPendiente.toNumber() - registrado);
      if (previo > 0.004) lineas.push({ fecha: v.fechaCobroSaldo ? fechaLocalAR(v.fechaCobroSaldo) : fecha, concepto: `Pago de la venta ${v.numeroVenta ?? ''} (sin detalle)`.trim(), debe: 0, haber: previo, ventaId: v.id });
    }
    for (const c of cobros.filter((x) => !x.anuladoAt)) {
      const ventasTxt = c.aplicaciones.map((a) => a.venta.numeroVenta).filter(Boolean).join(', ');
      lineas.push({ fecha: fechaLocalAR(c.fecha), concepto: `Pago en ${NOMBRE_PAGO[c.formaPago] ?? c.formaPago}${ventasTxt ? ` · ${ventasTxt}` : ''}`, debe: 0, haber: c.monto.toNumber(), cobroId: c.id });
    }
    const movimientos = estadoDeCuenta(lineas);
    const hoy = fechaHoyAR();
    const pendientes = ventas
      .filter((v) => v.saldoPendiente.toNumber() > 0)
      .map((v) => ({ ventaId: v.id, numero: v.numeroVenta, fecha: fechaLocalAR(v.fecha), saldo: v.saldoPendiente.toNumber(), dias: diasEntre(fechaLocalAR(v.fecha), hoy) }));
    return {
      cliente,
      saldo: r2(pendientes.reduce((a, p) => a + p.saldo, 0)),
      pendientes,
      movimientos,
      cobros: cobros
        .map((c) => ({ id: c.id, fecha: c.fecha, monto: c.monto.toNumber(), formaPago: c.formaPago, notas: c.notas, anulado: Boolean(c.anuladoAt), ventas: c.aplicaciones.map((a) => a.venta.numeroVenta).filter(Boolean) }))
        .reverse(),
    };
  }

  /** Registra un pago del cliente y lo aplica a sus ventas pendientes más viejas. */
  async cobrar(empresaId: string, clienteId: string, usuarioId: string, input: CobrarInput) {
    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({ where: { id: clienteId, empresaId, deletedAt: null }, select: { id: true } });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');
      const ventas = await tx.venta.findMany({ where: { empresaId, clienteId, deletedAt: null, saldoPendiente: { gt: 0 } }, select: { id: true, fecha: true, saldoPendiente: true } });
      const aplicaciones = aplicarCobro(
        ventas.map((v) => ({ ventaId: v.id, fecha: v.fecha.toISOString(), saldo: v.saldoPendiente.toNumber() })),
        input.monto,
      );
      if (!aplicaciones) {
        const deuda = r2(ventas.reduce((a, v) => a + v.saldoPendiente.toNumber(), 0));
        throw new BadRequestException(deuda > 0 ? `El pago no puede superar lo que debe ($${deuda.toLocaleString('es-AR')})` : 'Este cliente no tiene saldo pendiente');
      }
      for (const a of aplicaciones) {
        const { count } = await tx.venta.updateMany({ where: { id: a.ventaId, empresaId, deletedAt: null, saldoPendiente: { gte: a.monto } }, data: { saldoPendiente: { decrement: a.monto } } });
        if (count === 0) throw new ConflictException('El saldo cambió mientras se registraba el pago: probá de nuevo');
        const v = await tx.venta.findUniqueOrThrow({ where: { id: a.ventaId }, select: { saldoPendiente: true, fechaCobroSaldo: true } });
        if (v.saldoPendiente.toNumber() <= 0) await tx.venta.update({ where: { id: a.ventaId }, data: { estadoCobro: 'pagado', fechaCobroSaldo: input.fecha } });
      }
      const cobro = await tx.cobroCliente.create({
        data: { empresaId, clienteId, monto: input.monto, formaPago: input.formaPago, fecha: input.fecha, notas: input.notas, usuarioId, aplicaciones: { create: aplicaciones } },
      });
      return { id: cobro.id, aplicaciones: aplicaciones.length };
    });
  }

  /** Deshace un pago: las ventas vuelven a tener ese saldo pendiente. */
  async anularCobro(empresaId: string, cobroId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cobro = await tx.cobroCliente.findFirst({ where: { id: cobroId, empresaId }, include: { aplicaciones: true } });
      if (!cobro) throw new NotFoundException('Cobro no encontrado');
      const { count } = await tx.cobroCliente.updateMany({ where: { id: cobroId, anuladoAt: null }, data: { anuladoAt: new Date() } });
      if (count === 0) throw new BadRequestException('Ese cobro ya estaba anulado');
      for (const a of cobro.aplicaciones) {
        const v = await tx.venta.update({ where: { id: a.ventaId }, data: { saldoPendiente: { increment: a.monto }, fechaCobroSaldo: null }, select: { montoSenia: true } });
        await tx.venta.update({ where: { id: a.ventaId }, data: { estadoCobro: v.montoSenia.toNumber() > 0 ? 'señado' : 'saldo_pendiente' } });
      }
      return { ok: true };
    });
  }
}
