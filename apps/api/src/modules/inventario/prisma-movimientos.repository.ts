import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MovimientoInventario } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CrearMovimientoInput,
  MovimientoKardexRecord,
  MovimientoRecord,
  MovimientosRepository,
  ResultadoTraslado,
} from './movimientos.repository.js';
import { deltaStockKardex } from './inventario.util.js';

function etiquetaCombo(atributos: Record<string, string>): string {
  return Object.values(atributos ?? {})
    .filter(Boolean)
    .join('/');
}

@Injectable()
export class PrismaMovimientosRepository implements MovimientosRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(m: MovimientoInventario): MovimientoRecord {
    return {
      id: m.id,
      productoId: m.productoId,
      varianteId: m.varianteId,
      loteId: m.loteId,
      usuarioId: m.usuarioId,
      tipo: m.tipo,
      cantidad: m.cantidad.toNumber(),
      signo: m.signo as 1 | -1,
      costoUnitario: m.costoUnitario?.toNumber() ?? null,
      precioUnitario: m.precioUnitario?.toNumber() ?? null,
      motivo: m.motivo,
      ubicacionOrigen: m.ubicacionOrigen,
      ubicacionDestino: m.ubicacionDestino,
      referenciaId: m.referenciaId,
      fecha: m.fecha,
    };
  }

  async crear(empresaId: string, input: CrearMovimientoInput): Promise<MovimientoRecord | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: input.productoId, empresaId } });
    if (!producto) return null;
    const creado = await this.prisma.movimientoInventario.create({
      data: {
        empresaId,
        productoId: input.productoId,
        varianteId: input.varianteId ?? null,
        loteId: input.loteId ?? null,
        usuarioId: input.usuarioId,
        tipo: input.tipo,
        cantidad: input.cantidad,
        signo: input.signo,
        costoUnitario: input.costoUnitario ?? null,
        precioUnitario: input.precioUnitario ?? null,
        motivo: input.motivo ?? null,
        ubicacionOrigen: input.ubicacionOrigen ?? null,
        ubicacionDestino: input.ubicacionDestino ?? null,
        referenciaId: input.referenciaId ?? null,
      },
    });
    return this.toRecord(creado);
  }

  async registrarTraslado(
    empresaId: string,
    usuarioId: string,
    input: { productoId: string; cantidad: number; origen: string; destino: string; motivo: string | null; fecha: Date },
  ): Promise<ResultadoTraslado> {
    const producto = await this.prisma.producto.findFirst({ where: { id: input.productoId, empresaId } });
    if (!producto) return { ok: false, motivo: 'producto_no_encontrado' };

    if (input.origen === input.destino) return { ok: false, motivo: 'ubicacion_invalida' };
    const [origenValida, destinoValida] = await Promise.all([
      this.prisma.ubicacion.findFirst({ where: { empresaId, nombre: input.origen } }),
      this.prisma.ubicacion.findFirst({ where: { empresaId, nombre: input.destino } }),
    ]);
    if (!origenValida || !destinoValida) return { ok: false, motivo: 'ubicacion_invalida' };

    const datosComunes = {
      empresaId,
      productoId: input.productoId,
      usuarioId,
      tipo: 'transferencia',
      cantidad: input.cantidad,
      ubicacionOrigen: input.origen,
      ubicacionDestino: input.destino,
      motivo: input.motivo,
      fecha: input.fecha,
    };

    const [salida, entrada] = await this.prisma.$transaction([
      this.prisma.movimientoInventario.create({ data: { ...datosComunes, signo: -1 } }),
      this.prisma.movimientoInventario.create({ data: { ...datosComunes, signo: 1 } }),
    ]);
    return { ok: true, movimientos: [this.toRecord(salida), this.toRecord(entrada)] };
  }

  async calcularStockActual(empresaId: string, productoId: string, varianteId?: string | null): Promise<number> {
    const filtroVariante =
      varianteId === undefined
        ? Prisma.empty
        : varianteId === null
          ? Prisma.sql`AND variante_id IS NULL`
          : Prisma.sql`AND variante_id = ${varianteId}::uuid`;
    const filas = await this.prisma.$queryRaw<{ stock: string | null }[]>(Prisma.sql`
      SELECT COALESCE(SUM(cantidad * signo), 0) AS stock
      FROM movimientos_inventario
      WHERE empresa_id = ${empresaId}::uuid
        AND producto_id = ${productoId}::uuid
        AND tipo <> 'transferencia'
        AND deleted_at IS NULL
        ${filtroVariante}
    `);
    return Number(filas[0]?.stock ?? 0);
  }

  async listarKardex(
    empresaId: string,
    productoId: string,
    filtro: { pagina: number; pageSize: number },
  ): Promise<{ filas: MovimientoKardexRecord[]; total: number } | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId } });
    if (!producto) return null;

    const where = { empresaId, productoId, deletedAt: null } as const;
    const orderBy = [{ fecha: 'desc' as const }, { id: 'desc' as const }];
    const from = (filtro.pagina - 1) * filtro.pageSize;

    const [total, pagina, saltados, stockActual] = await Promise.all([
      this.prisma.movimientoInventario.count({ where }),
      this.prisma.movimientoInventario.findMany({ where, orderBy, skip: from, take: filtro.pageSize }),
      from > 0
        ? this.prisma.movimientoInventario.findMany({
            where,
            orderBy,
            skip: 0,
            take: from,
            select: { tipo: true, cantidad: true, signo: true },
          })
        : Promise.resolve([]),
      this.calcularStockActual(empresaId, productoId),
    ]);

    const netNewer = saltados.reduce(
      (acc, m) => acc + deltaStockKardex(m.tipo, m.cantidad.toNumber(), m.signo),
      0,
    );

    const usuarioIds = [...new Set(pagina.map((m) => m.usuarioId))];
    const ventaIds = [...new Set(pagina.filter((m) => m.tipo === 'venta' && m.referenciaId).map((m) => m.referenciaId!))];
    const varianteIds = [...new Set(pagina.filter((m) => m.varianteId).map((m) => m.varianteId!))];
    const loteIds = [...new Set(pagina.filter((m) => m.loteId).map((m) => m.loteId!))];

    const [usuarios, ventas, variantes, lotes] = await Promise.all([
      usuarioIds.length > 0 ? this.prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nombre: true } }) : [],
      ventaIds.length > 0 ? this.prisma.venta.findMany({ where: { id: { in: ventaIds } }, select: { id: true, fecha: true } }) : [],
      varianteIds.length > 0
        ? this.prisma.productoVariante.findMany({ where: { id: { in: varianteIds } }, select: { id: true, atributos: true } })
        : [],
      loteIds.length > 0 ? this.prisma.lote.findMany({ where: { id: { in: loteIds } }, select: { id: true, numeroLote: true } }) : [],
    ]);
    const nombresUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));
    const fechasVenta = new Map(ventas.map((v) => [v.id, v.fecha]));
    const etiquetasVariante = new Map(
      variantes.map((v) => [v.id, etiquetaCombo(v.atributos as Record<string, string>)]),
    );
    const numerosLote = new Map(lotes.map((l) => [l.id, l.numeroLote]));

    let saldo = stockActual - netNewer;
    const filas: MovimientoKardexRecord[] = pagina.map((m) => {
      const base = this.toRecord(m);
      const item: MovimientoKardexRecord = {
        ...base,
        saldo,
        usuarioNombre: nombresUsuario.get(m.usuarioId) ?? '—',
        ventaFecha: m.referenciaId ? (fechasVenta.get(m.referenciaId) ?? null) : null,
        varianteEtiqueta: m.varianteId ? (etiquetasVariante.get(m.varianteId) ?? null) : null,
        numeroLote: m.loteId ? (numerosLote.get(m.loteId) ?? null) : null,
      };
      saldo -= deltaStockKardex(base.tipo, base.cantidad, base.signo);
      return item;
    });

    return { filas, total };
  }
}
