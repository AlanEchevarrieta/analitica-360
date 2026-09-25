import { Injectable } from '@nestjs/common';
import { Prisma, type Producto } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  DimensionesProducto,
  GuardarProductoInput,
  ListaProductos,
  ProductoListado,
  ProductoRecord,
  ProductosFiltro,
  ProductosRepository,
  ResultadoGuardarProducto,
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

  private async categoriaValida(empresaId: string, categoriaId: string | null): Promise<boolean> {
    if (categoriaId === null) return true;
    const categoria = await this.prisma.categoria.findFirst({ where: { id: categoriaId, empresaId } });
    return categoria != null;
  }

  async crear(empresaId: string, input: GuardarProductoInput): Promise<ResultadoGuardarProducto> {
    if (!(await this.categoriaValida(empresaId, input.categoriaId))) {
      return { ok: false, motivo: 'categoria_invalida' };
    }
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
    return { ok: true, producto: this.toRecord(producto) };
  }

  async actualizar(empresaId: string, id: string, input: GuardarProductoInput): Promise<ResultadoGuardarProducto> {
    const existente = await this.prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existente) return { ok: false, motivo: 'producto_no_encontrado' };
    if (!(await this.categoriaValida(empresaId, input.categoriaId))) {
      return { ok: false, motivo: 'categoria_invalida' };
    }

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
    return { ok: true, producto: this.toRecord(producto) };
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

    const from = (filtro.pagina - 1) * filtro.pageSize;
    const activosPromise = this.prisma.producto.count({ where: { empresaId, deletedAt: null, activo: true } });

    // Camino rápido (el caso común: sin filtro de margen) - paginación real
    // en Postgres via skip/take. El margen (precioVenta/costo) no es
    // filtrable en SQL de forma simple, así que solo en ese caso se cae al
    // camino lento: traer todo lo filtrado por DB y filtrar/paginar en
    // memoria, igual que hacía listarProductosPaginado() en el legacy.
    if (filtro.margen === 'todos') {
      const [filas, total, activos] = await Promise.all([
        this.prisma.producto.findMany({
          where,
          include: { categoriaRel: { select: { nombre: true } } },
          orderBy: { nombre: 'asc' },
          skip: from,
          take: filtro.pageSize,
        }),
        this.prisma.producto.count({ where }),
        activosPromise,
      ]);
      return { items: await this.conStock(empresaId, filas.map((p) => this.toRecord(p))), total, activos };
    }

    const [filas, activos] = await Promise.all([
      this.prisma.producto.findMany({
        where,
        include: { categoriaRel: { select: { nombre: true } } },
        orderBy: { nombre: 'asc' },
      }),
      activosPromise,
    ]);

    const registros = filas.map((p) => this.toRecord(p));
    const filtrados = registros.filter((p) => coincideMargen(filtro.margen, p.precioVenta, p.costo));

    return {
      items: await this.conStock(empresaId, filtrados.slice(from, from + filtro.pageSize)),
      total: filtrados.length,
      activos,
    };
  }

  private async conStock(empresaId: string, productos: ProductoRecord[]): Promise<ProductoListado[]> {
    if (productos.length === 0) return [];
    const filas = await this.prisma.$queryRaw<{ producto_id: string; stock: string }[]>(Prisma.sql`
      SELECT producto_id, SUM(cantidad * signo) AS stock
      FROM movimientos_inventario
      WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL
        AND producto_id IN (${Prisma.join(productos.map((p) => Prisma.sql`${p.id}::uuid`))})
      GROUP BY producto_id
    `);
    const stock = new Map(filas.map((f) => [f.producto_id, Number(f.stock)]));
    return productos.map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 }));
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
