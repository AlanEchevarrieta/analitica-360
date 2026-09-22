import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MovimientoInventario } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CrearMovimientoInput,
  MovimientoKardexRecord,
  MovimientoRecord,
  MovimientosRepository,
  ResultadoCrearMovimiento,
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

  async crear(empresaId: string, input: CrearMovimientoInput): Promise<ResultadoCrearMovimiento> {
    const producto = await this.prisma.producto.findFirst({ where: { id: input.productoId, empresaId } });
    if (!producto) return { ok: false, motivo: 'producto_no_encontrado' };
    if (input.varianteId) {
      const variante = await this.prisma.productoVariante.findFirst({
        where: { id: input.varianteId, productoId: input.productoId, empresaId },
      });
      if (!variante) return { ok: false, motivo: 'variante_invalida' };
    }
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
    return { ok: true, movimiento: this.toRecord(creado) };
  }

  /** Stock del producto en una ubicación puntual - misma semántica que stockPorUbicaciones() del legacy, acotada a una ubicación. */
  private async stockEnUbicacion(
    tx: Prisma.TransactionClient,
    empresaId: string,
    productoId: string,
    ubicacion: string,
  ): Promise<number> {
    const filas = await tx.$queryRaw<{ stock: string | null }[]>(Prisma.sql`
      SELECT COALESCE(SUM(
        CASE
          WHEN tipo = 'transferencia' AND signo = -1 AND ubicacion_origen = ${ubicacion} THEN -cantidad
          WHEN tipo = 'transferencia' AND signo = 1 AND ubicacion_destino = ${ubicacion} THEN cantidad
          WHEN tipo <> 'transferencia' AND ubicacion_destino = ${ubicacion} THEN cantidad * signo
          WHEN tipo <> 'transferencia' AND ubicacion_destino IS NULL AND ubicacion_origen = ${ubicacion} THEN cantidad * signo
          ELSE 0
        END
      ), 0) AS stock
      FROM movimientos_inventario
      WHERE empresa_id = ${empresaId}::uuid
        AND producto_id = ${productoId}::uuid
        AND deleted_at IS NULL
    `);
    return Number(filas[0]?.stock ?? 0);
  }

  async registrarTraslado(
    empresaId: string,
    usuarioId: string,
    input: { productoId: string; cantidad: number; origen: string; destino: string; motivo: string | null; fecha: Date },
  ): Promise<ResultadoTraslado> {
    // Transacción interactiva con aislamiento Serializable: valida producto,
    // ubicaciones y stock suficiente en origen, y crea el par de filas, todo
    // como una unidad atómica - evita la ventana de carrera de traslados
    // concurrentes que dos $create sueltos (o validar fuera de la tx) dejaban
    // abierta.
    return this.prisma.$transaction(
      async (tx) => {
        const producto = await tx.producto.findFirst({ where: { id: input.productoId, empresaId } });
        if (!producto) return { ok: false, motivo: 'producto_no_encontrado' };

        if (input.origen === input.destino) return { ok: false, motivo: 'ubicacion_invalida' };
        const [origenValida, destinoValida] = await Promise.all([
          tx.ubicacion.findFirst({ where: { empresaId, nombre: input.origen } }),
          tx.ubicacion.findFirst({ where: { empresaId, nombre: input.destino } }),
        ]);
        if (!origenValida || !destinoValida) return { ok: false, motivo: 'ubicacion_invalida' };

        const stockOrigen = await this.stockEnUbicacion(tx, empresaId, input.productoId, input.origen);
        if (stockOrigen < input.cantidad) return { ok: false, motivo: 'stock_insuficiente' };

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
        const salida = await tx.movimientoInventario.create({ data: { ...datosComunes, signo: -1 } });
        const entrada = await tx.movimientoInventario.create({ data: { ...datosComunes, signo: 1 } });
        return { ok: true, movimientos: [this.toRecord(salida), this.toRecord(entrada)] };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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

    // empresaId explícito en cada join, aunque los ids ya salen de filas
    // scopeadas - defensa en profundidad, no depender de que ningún otro
    // punto de escritura pueda colar un id de otra empresa acá (ver
    // aislamiento multi-tenant en el plan).
    const [usuarios, ventas, variantes, lotes] = await Promise.all([
      usuarioIds.length > 0
        ? this.prisma.usuario.findMany({ where: { id: { in: usuarioIds }, empresaId }, select: { id: true, nombre: true } })
        : [],
      ventaIds.length > 0
        ? this.prisma.venta.findMany({ where: { id: { in: ventaIds }, empresaId }, select: { id: true, fecha: true } })
        : [],
      varianteIds.length > 0
        ? this.prisma.productoVariante.findMany({
            where: { id: { in: varianteIds }, empresaId },
            select: { id: true, atributos: true },
          })
        : [],
      loteIds.length > 0
        ? this.prisma.lote.findMany({ where: { id: { in: loteIds }, empresaId }, select: { id: true, numeroLote: true } })
        : [],
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
