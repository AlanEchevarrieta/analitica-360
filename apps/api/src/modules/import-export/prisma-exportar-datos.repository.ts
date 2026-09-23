import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  ExportarDatosRepository,
  ExportCompraCabecera,
  ExportCompraItem,
  ExportGasto,
  ExportMovimientoInventario,
  ExportProducto,
  ExportVentaCabecera,
  ExportVentaItem,
} from './exportar-datos.repository.js';

@Injectable()
export class PrismaExportarDatosRepository implements ExportarDatosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ventas(empresaId: string): Promise<{ cabecera: ExportVentaCabecera[]; items: ExportVentaItem[] }> {
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        numeroVenta: true,
        fecha: true,
        formaPago: true,
        clienteNombre: true,
        cuotas: true,
        descuento: true,
        totalSinInteres: true,
        totalConInteres: true,
        notas: true,
        montoSenia: true,
        saldoPendiente: true,
        estadoCobro: true,
        items: { select: { cantidad: true, precioUnitario: true, producto: { select: { nombre: true } } } },
      },
    });
    const cabecera: ExportVentaCabecera[] = ventas.map((v) => ({
      numeroVenta: v.numeroVenta,
      fecha: v.fecha.toISOString(),
      cliente: v.clienteNombre,
      formaPago: v.formaPago,
      cuotas: v.cuotas,
      descuento: v.descuento.toNumber(),
      total: v.totalConInteres?.toNumber() ?? v.totalSinInteres?.toNumber() ?? 0,
      senia: v.montoSenia.toNumber(),
      saldoPendiente: v.saldoPendiente.toNumber(),
      estadoCobro: v.estadoCobro,
      notas: v.notas,
    }));
    const items: ExportVentaItem[] = ventas.flatMap((v) =>
      v.items.map((it) => ({ ventaId: v.id, producto: it.producto.nombre, cantidad: it.cantidad, precioUnitario: it.precioUnitario.toNumber() })),
    );
    return { cabecera, items };
  }

  async productos(empresaId: string): Promise<ExportProducto[]> {
    const filas = await this.prisma.$queryRaw<
      { nombre: string; categoria: string | null; activo: boolean; precio_venta: string | null; costo: string | null; codigo_barra: string | null; stock: string }[]
    >(Prisma.sql`
      SELECT
        p.nombre, p.categoria, p.activo, p.precio_venta, p.costo, p.codigo_barra,
        COALESCE((
          SELECT SUM(m.cantidad * m.signo) FROM movimientos_inventario m
          WHERE m.producto_id = p.id AND m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL
        ), 0) AS stock
      FROM productos p
      WHERE p.empresa_id = ${empresaId}::uuid AND p.deleted_at IS NULL
      ORDER BY p.nombre
    `);
    return filas.map((f) => ({
      nombre: f.nombre,
      categoria: f.categoria,
      activo: f.activo,
      precioVenta: f.precio_venta == null ? null : Number(f.precio_venta),
      costo: f.costo == null ? null : Number(f.costo),
      stock: Number(f.stock),
      codigoBarra: f.codigo_barra,
    }));
  }

  async compras(empresaId: string): Promise<{ cabecera: ExportCompraCabecera[]; items: ExportCompraItem[] }> {
    const compras = await this.prisma.compra.findMany({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'desc' },
      select: {
        fecha: true,
        proveedorNombre: true,
        total: true,
        notas: true,
        costoFlete: true,
        costoImpuestos: true,
        costoOtros: true,
        totalReal: true,
        items: { select: { productoNombre: true, cantidad: true, costoUnitario: true, subtotal: true } },
      },
    });
    const cabecera: ExportCompraCabecera[] = compras.map((c) => ({
      fecha: c.fecha.toISOString(),
      proveedor: c.proveedorNombre,
      subtotalProductos: c.total?.toNumber() ?? 0,
      flete: c.costoFlete.toNumber(),
      impuestos: c.costoImpuestos.toNumber(),
      otros: c.costoOtros.toNumber(),
      totalReal: c.totalReal.toNumber() || c.total?.toNumber() || 0,
      notas: c.notas,
    }));
    const items: ExportCompraItem[] = compras.flatMap((c) =>
      c.items.map((it) => ({
        fecha: c.fecha.toISOString(),
        proveedor: c.proveedorNombre,
        producto: it.productoNombre,
        cantidad: it.cantidad,
        costoUnitario: it.costoUnitario.toNumber(),
        subtotal: it.subtotal.toNumber(),
      })),
    );
    return { cabecera, items };
  }

  async inventario(empresaId: string): Promise<ExportMovimientoInventario[]> {
    const movs = await this.prisma.movimientoInventario.findMany({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'desc' },
      select: {
        fecha: true,
        tipo: true,
        cantidad: true,
        signo: true,
        motivo: true,
        costoUnitario: true,
        ubicacionOrigen: true,
        ubicacionDestino: true,
        producto: { select: { nombre: true } },
      },
    });
    return movs.map((m) => ({
      fecha: m.fecha.toISOString(),
      producto: m.producto.nombre,
      tipo: m.tipo,
      cantidad: m.cantidad.toNumber(),
      signo: m.signo,
      motivo: m.motivo,
      costoUnitario: m.costoUnitario == null ? null : m.costoUnitario.toNumber(),
      origen: m.ubicacionOrigen,
      destino: m.ubicacionDestino,
    }));
  }

  async gastos(empresaId: string): Promise<ExportGasto[]> {
    const gastos = await this.prisma.gasto.findMany({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'desc' },
      select: { fecha: true, categoria: true, descripcion: true, monto: true, recurrente: true, frecuencia: true },
    });
    return gastos.map((g) => ({
      fecha: g.fecha.toISOString().slice(0, 10),
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto.toNumber(),
      recurrente: g.recurrente,
      frecuencia: g.frecuencia,
    }));
  }
}
