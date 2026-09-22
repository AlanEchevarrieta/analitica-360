import { Injectable } from '@nestjs/common';
import type { Prisma, Producto } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  DimensionesProducto,
  GuardarProductoInput,
  ListaProductos,
  ProductoRecord,
  ProductosFiltro,
  ProductosRepository,
} from './productos.repository.js';
import { coincideMargen, esBusquedaCodigoBarras } from './productos.util.js';

type ProductoConCategoria = Producto & { categoriaRel: { nombre: string } | null };

@Injectable()
export class PrismaProductosRepository implements ProductosRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(producto: ProductoConCategoria): ProductoRecord {
    return {
      id: producto.id,
      empresaId: producto.empresaId,
      nombre: producto.nombre,
      categoriaId: producto.categoriaId,
      categoriaNombre: producto.categoriaRel?.nombre ?? null,
      codigoBarra: producto.codigoBarra,
      precioVenta: producto.precioVenta?.toNumber() ?? null,
      costo: producto.costo?.toNumber() ?? null,
      activo: producto.activo,
      altoCm: producto.altoCm?.toNumber() ?? null,
      largoCm: producto.largoCm?.toNumber() ?? null,
      anchoCm: producto.anchoCm?.toNumber() ?? null,
      pesoGr: producto.pesoGr?.toNumber() ?? null,
    };
  }

  async crear(empresaId: string, input: GuardarProductoInput): Promise<ProductoRecord> {
    const producto = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          empresaId,
          nombre: input.nombre,
          categoriaId: input.categoriaId,
          precioVenta: input.precioVenta,
          costo: input.costo,
          activo: input.activo,
        },
        include: { categoriaRel: { select: { nombre: true } } },
      });
      // PrecioHistorial.costo es NOT NULL - solo se registra cuando ambos
      // valores están definidos (ver comentario en schema.prisma).
      if (input.precioVenta != null && input.costo != null) {
        await tx.precioHistorial.create({
          data: {
            empresaId,
            productoId: creado.id,
            precioVenta: input.precioVenta,
            costo: input.costo,
          },
        });
      }
      return creado;
    });
    return this.toRecord(producto);
  }

  async actualizar(empresaId: string, id: string, input: GuardarProductoInput): Promise<ProductoRecord | null> {
    const existente = await this.prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existente) return null;

    const producto = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.producto.update({
        where: { id },
        data: {
          nombre: input.nombre,
          categoriaId: input.categoriaId,
          precioVenta: input.precioVenta,
          costo: input.costo,
          activo: input.activo,
        },
        include: { categoriaRel: { select: { nombre: true } } },
      });
      if (input.precioVenta != null && input.costo != null) {
        await tx.precioHistorial.create({
          data: { empresaId, productoId: id, precioVenta: input.precioVenta, costo: input.costo },
        });
      }
      return actualizado;
    });
    return this.toRecord(producto);
  }

  async buscarPorId(empresaId: string, id: string): Promise<ProductoRecord | null> {
    const producto = await this.prisma.producto.findFirst({
      where: { id, empresaId, deletedAt: null },
      include: { categoriaRel: { select: { nombre: true } } },
    });
    return producto ? this.toRecord(producto) : null;
  }

  async listar(empresaId: string, filtro: ProductosFiltro): Promise<ListaProductos> {
    const busqueda = filtro.busqueda.trim();
    const esBarcode = busqueda.length > 0 && esBusquedaCodigoBarras(busqueda);

    const where: Prisma.ProductoWhereInput = {
      empresaId,
      deletedAt: null,
      ...(filtro.categoriaId ? { categoriaId: filtro.categoriaId } : {}),
      ...(filtro.estado === 'activos' ? { activo: true } : {}),
      ...(filtro.estado === 'inactivos' ? { activo: false } : {}),
      ...(busqueda
        ? {
            OR: esBarcode
              ? [{ codigoBarra: busqueda }, { nombre: { contains: busqueda, mode: 'insensitive' } }]
              : [{ nombre: { contains: busqueda, mode: 'insensitive' } }],
          }
        : {}),
    };

    // El margen (precioVenta/costo) no es filtrable en SQL de forma simple -
    // se trae el subconjunto ya filtrado por DB y se filtra/pagina en memoria,
    // igual que hacía listarProductosPaginado() en el legacy.
    const [filas, activos] = await Promise.all([
      this.prisma.producto.findMany({
        where,
        include: { categoriaRel: { select: { nombre: true } } },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.producto.count({ where: { empresaId, deletedAt: null, activo: true } }),
    ]);

    const registros = filas.map((p) => this.toRecord(p));
    const filtrados = registros.filter((p) => coincideMargen(filtro.margen, p.precioVenta, p.costo));

    const from = (filtro.pagina - 1) * filtro.pageSize;
    return {
      items: filtrados.slice(from, from + filtro.pageSize),
      total: filtrados.length,
      activos,
    };
  }

  async listarNombres(empresaId: string): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.producto.findMany({
      where: { empresaId, deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async guardarCodigoBarra(empresaId: string, id: string, codigoBarra: string | null): Promise<ProductoRecord | null> {
    const existente = await this.prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existente) return null;
    const producto = await this.prisma.producto.update({
      where: { id },
      data: { codigoBarra },
      include: { categoriaRel: { select: { nombre: true } } },
    });
    return this.toRecord(producto);
  }

  async guardarDimensiones(
    empresaId: string,
    id: string,
    dimensiones: DimensionesProducto,
  ): Promise<ProductoRecord | null> {
    const existente = await this.prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existente) return null;
    const producto = await this.prisma.producto.update({
      where: { id },
      data: {
        altoCm: dimensiones.altoCm,
        largoCm: dimensiones.largoCm,
        anchoCm: dimensiones.anchoCm,
        pesoGr: dimensiones.pesoGr,
      },
      include: { categoriaRel: { select: { nombre: true } } },
    });
    return this.toRecord(producto);
  }
}
