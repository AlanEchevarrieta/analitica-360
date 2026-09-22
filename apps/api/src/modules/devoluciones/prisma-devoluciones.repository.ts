import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MovimientoInventario } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  DevolucionesRepository,
  DevolucionFicha,
  DevolucionRecord,
  EstadoDevolucion,
  FiltrosDevoluciones,
  MotivoRechazoDevolucion,
  RegistrarDevolucionInput,
  ResultadoRegistrarDevolucion,
  ResultadoTransicionDevolucion,
  TipoDevolucion,
  TipoItemDevolucion,
  VentaBusquedaHit,
} from './devoluciones.repository.js';

const includeCabecera = {
  venta: { select: { numeroVenta: true, clienteNombre: true } },
} satisfies Prisma.DevolucionInclude;

const includeFicha = {
  ...includeCabecera,
  items: { include: { producto: { select: { nombre: true } } } },
} satisfies Prisma.DevolucionInclude;

type DevolucionConCabecera = Prisma.DevolucionGetPayload<{ include: typeof includeCabecera }>;
type DevolucionConFicha = Prisma.DevolucionGetPayload<{ include: typeof includeFicha }>;

function toMovimientoRecord(m: MovimientoInventario) {
  return { id: m.id, tipo: m.tipo, cantidad: m.cantidad.toNumber(), signo: m.signo, fecha: m.fecha };
}

@Injectable()
export class PrismaDevolucionesRepository implements DevolucionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(d: DevolucionConCabecera): DevolucionRecord {
    return {
      id: d.id,
      empresaId: d.empresaId,
      numero: d.numero,
      tipo: d.tipo as TipoDevolucion,
      estado: d.estado as EstadoDevolucion,
      fecha: d.fecha,
      ventaId: d.ventaId,
      ventaLabel: d.venta ? `${d.venta.numeroVenta ?? 'Venta'} · ${d.venta.clienteNombre ?? 'Sin cliente'}` : null,
      motivo: d.motivo,
      notas: d.notas,
      productos: '',
    };
  }

  private toFicha(d: DevolucionConFicha, movimientos: MovimientoInventario[]): DevolucionFicha {
    const productos =
      d.items
        .map((i) => `${i.producto.nombre} × ${i.cantidad.toNumber()} (${i.tipo === 'entregado' ? 'lleva' : 'trae'})`)
        .join(', ') || '—';
    return {
      ...this.toRecord(d),
      productos,
      items: d.items.map((i) => ({
        id: i.id,
        productoId: i.productoId,
        productoNombre: i.producto.nombre,
        varianteId: i.varianteId,
        cantidad: i.cantidad.toNumber(),
        precioUnitario: i.precioUnitario.toNumber(),
        tipo: i.tipo as TipoItemDevolucion,
      })),
      movimientos: movimientos.map(toMovimientoRecord),
    };
  }

  async listar(empresaId: string, filtro: FiltrosDevoluciones): Promise<DevolucionRecord[]> {
    const fechaFiltro: Prisma.DateTimeFilter = {};
    if (filtro.desde) fechaFiltro.gte = new Date(`${filtro.desde}T00:00:00.000-03:00`);
    if (filtro.hasta) fechaFiltro.lte = new Date(`${filtro.hasta}T23:59:59.999-03:00`);

    const where: Prisma.DevolucionWhereInput = {
      empresaId,
      deletedAt: null,
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(Object.keys(fechaFiltro).length > 0 ? { fecha: fechaFiltro } : {}),
    };
    const filas = await this.prisma.devolucion.findMany({
      where,
      include: { ...includeCabecera, items: { include: { producto: { select: { nombre: true } } } } },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
    return filas.map((d) => ({
      ...this.toRecord(d),
      productos:
        d.items
          .map((i) => `${i.producto.nombre} × ${i.cantidad.toNumber()} (${i.tipo === 'entregado' ? 'lleva' : 'trae'})`)
          .join(', ') || '—',
    }));
  }

  async ficha(empresaId: string, id: string): Promise<DevolucionFicha | null> {
    const devolucion = await this.prisma.devolucion.findFirst({ where: { id, empresaId }, include: includeFicha });
    if (!devolucion) return null;
    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: { empresaId, referenciaId: id, deletedAt: null },
      orderBy: { fecha: 'asc' },
    });
    return this.toFicha(devolucion, movimientos);
  }

  async registrar(empresaId: string, input: RegistrarDevolucionInput): Promise<ResultadoRegistrarDevolucion> {
    if (input.items.length === 0) return { ok: false, motivo: 'sin_items' };
    // Un item 'entregado' (el negocio le da algo al cliente) solo tiene
    // sentido en un cambio - una devolución simple solo recibe.
    if (input.tipo === 'devolucion' && input.items.some((i) => i.tipo === 'entregado')) {
      return { ok: false, motivo: 'item_invalido' as MotivoRechazoDevolucion };
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.ventaId) {
        const venta = await tx.venta.findFirst({ where: { id: input.ventaId, empresaId } });
        if (!venta) return { ok: false, motivo: 'venta_invalida' };
      }

      const productoIds = [...new Set(input.items.map((i) => i.productoId))];
      const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, empresaId } });
      if (productos.length !== productoIds.length) return { ok: false, motivo: 'item_invalido' };

      const varianteIds = [...new Set(input.items.filter((i) => i.varianteId).map((i) => i.varianteId!))];
      if (varianteIds.length > 0) {
        const variantes = await tx.productoVariante.findMany({ where: { id: { in: varianteIds }, empresaId } });
        if (variantes.length !== varianteIds.length) return { ok: false, motivo: 'item_invalido' };
        const productoDeVariante = new Map(variantes.map((v) => [v.id, v.productoId]));
        const validas = input.items.every((i) => !i.varianteId || productoDeVariante.get(i.varianteId) === i.productoId);
        if (!validas) return { ok: false, motivo: 'item_invalido' };
      }

      // Sin tabla de numeración propia en el schema (a diferencia de
      // Venta/OrdenCompra) - correlativo simple por count, aceptable para un
      // campo de visualización de baja concurrencia.
      const numero = (await tx.devolucion.count({ where: { empresaId } })) + 1;

      const creada = await tx.devolucion.create({
        data: {
          empresaId,
          usuarioId: input.usuarioId,
          ventaId: input.ventaId,
          numero,
          tipo: input.tipo,
          motivo: input.motivo,
          estado: 'pendiente',
          notas: input.notas,
          items: {
            create: input.items.map((i) => ({
              productoId: i.productoId,
              varianteId: i.varianteId ?? null,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              tipo: i.tipo,
            })),
          },
        },
        include: includeFicha,
      });

      for (const item of input.items) {
        const esDevuelto = item.tipo === 'devuelto';
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: item.productoId,
            varianteId: item.varianteId ?? null,
            usuarioId: input.usuarioId,
            tipo: esDevuelto ? 'devolucion_cliente' : 'cambio',
            cantidad: item.cantidad,
            signo: esDevuelto ? 1 : -1,
            precioUnitario: item.precioUnitario,
            referenciaId: creada.id,
          },
        });
      }

      const movimientos = await tx.movimientoInventario.findMany({
        where: { empresaId, referenciaId: creada.id },
        orderBy: { fecha: 'asc' },
      });
      return { ok: true, devolucion: this.toFicha(creada, movimientos) };
    });
  }

  async procesar(empresaId: string, id: string): Promise<ResultadoTransicionDevolucion> {
    const devolucion = await this.prisma.devolucion.findFirst({ where: { id, empresaId } });
    if (!devolucion) return 'no_encontrada';
    if (devolucion.estado !== 'pendiente') return 'no_pendiente';
    await this.prisma.devolucion.update({ where: { id }, data: { estado: 'procesado' } });
    return 'ok';
  }

  async cancelar(empresaId: string, usuarioId: string, id: string): Promise<ResultadoTransicionDevolucion> {
    return this.prisma.$transaction(async (tx) => {
      const devolucion = await tx.devolucion.findFirst({ where: { id, empresaId } });
      if (!devolucion) return 'no_encontrada';
      if (devolucion.estado !== 'pendiente') return 'no_pendiente';

      const movimientosOriginales = await tx.movimientoInventario.findMany({
        where: { empresaId, referenciaId: id, deletedAt: null },
      });
      for (const m of movimientosOriginales) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: m.productoId,
            varianteId: m.varianteId,
            usuarioId,
            tipo: m.tipo,
            cantidad: m.cantidad,
            signo: m.signo === 1 ? -1 : 1,
            motivo: 'Cancelación de devolución',
            referenciaId: id,
          },
        });
      }

      await tx.devolucion.update({ where: { id }, data: { estado: 'cancelado' } });
      return 'ok';
    });
  }

  async buscarVentas(empresaId: string, q: string): Promise<VentaBusquedaHit[]> {
    const t = q.trim();
    if (t.length === 0) return [];
    const ventas = await this.prisma.venta.findMany({
      where: {
        empresaId,
        deletedAt: null,
        OR: [
          { numeroVenta: { contains: t, mode: 'insensitive' } },
          { clienteNombre: { contains: t, mode: 'insensitive' } },
        ],
      },
      orderBy: { fecha: 'desc' },
      take: 12,
      include: { items: { include: { producto: { select: { nombre: true } } } } },
    });
    return ventas.map((v) => ({
      id: v.id,
      label: `${v.numeroVenta ?? v.id.slice(0, 8)} · ${v.clienteNombre ?? 'Sin cliente'}`,
      items: v.items.map((i) => ({
        productoId: i.productoId,
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario.toNumber(),
      })),
    }));
  }
}
