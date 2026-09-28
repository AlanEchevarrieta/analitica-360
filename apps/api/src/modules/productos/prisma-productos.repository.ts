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

/** Ventana para medir la demanda de cada producto. */
const DIAS_DEMANDA = 90;

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
      sku: producto.sku,
      usaVariantes: producto.usaVariantes,
      esInsumo: producto.esInsumo,
      unidad: producto.unidad,
      enTienda: producto.enTienda,
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
          esInsumo: input.esInsumo ?? false,
          unidad: input.unidad ?? 'unidad',
          enTienda: input.enTienda ?? true,
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
          ...(input.esInsumo !== undefined ? { esInsumo: input.esInsumo } : {}),
          ...(input.unidad ? { unidad: input.unidad } : {}),
          ...(input.enTienda !== undefined ? { enTienda: input.enTienda } : {}),
        },
        include: { categoriaRel: { select: { nombre: true } } },
      });
      // Solo si cambió precio o costo: guardar el producto sin tocar precios
      // no debe ensuciar el historial (lo usa Insights para analizar precios).
      const cambioPrecio =
        (existente.precioVenta?.toNumber() ?? null) !== (input.precioVenta ?? null) ||
        (existente.costo?.toNumber() ?? null) !== (input.costo ?? null);
      if (cambioPrecio && input.precioVenta != null && input.costo != null) {
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
      ...(filtro.tipo === 'venta' ? { esInsumo: false } : filtro.tipo === 'insumos' ? { esInsumo: true } : {}),
      ...(busqueda
        ? {
            OR: [
              ...(esBarcode ? [{ codigoBarra: busqueda }] : []),
              { nombre: { contains: busqueda, mode: 'insensitive' } },
              // SKU del producto o de alguna de sus variantes.
              { sku: { equals: busqueda, mode: 'insensitive' } },
              { variantes: { some: { deletedAt: null, sku: { equals: busqueda, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const from = (filtro.pagina - 1) * filtro.pageSize;
    const activosPromise = this.prisma.producto.count({ where: { empresaId, deletedAt: null, activo: true } });

    // Camino rápido (el caso común: sin filtro de margen y orden por nombre) -
    // paginación real en Postgres via skip/take. El margen (precioVenta/costo)
    // no es filtrable en SQL de forma simple y la demanda depende de las
    // ventas, así que en esos casos se cae al camino lento: traer todo lo
    // filtrado por DB y filtrar/ordenar/paginar en memoria, igual que hacía
    // listarProductosPaginado() en el legacy.
    if (filtro.margen === 'todos' && filtro.orden === 'nombre') {
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
      return { items: await this.conStockYDemanda(empresaId, filas.map((p) => this.toRecord(p))), total, activos };
    }

    const [filas, activos] = await Promise.all([
      this.prisma.producto.findMany({
        where,
        include: { categoriaRel: { select: { nombre: true } } },
        orderBy: { nombre: 'asc' },
      }),
      activosPromise,
    ]);

    const filtrados = filas
      .map((p) => this.toRecord(p))
      .filter((p) => coincideMargen(filtro.margen, p.precioVenta, p.costo));

    if (filtro.orden === 'demanda') {
      const conDemanda = await this.conStockYDemanda(empresaId, filtrados);
      conDemanda.sort((a, b) => b.vendidos - a.vendidos || a.nombre.localeCompare(b.nombre, 'es'));
      return { items: conDemanda.slice(from, from + filtro.pageSize), total: conDemanda.length, activos };
    }

    return {
      items: await this.conStockYDemanda(empresaId, filtrados.slice(from, from + filtro.pageSize)),
      total: filtrados.length,
      activos,
    };
  }

  /**
   * Stock actual (SUM(cantidad*signo), mismo criterio que el dashboard) y
   * demanda: unidades vendidas en los últimos DIAS_DEMANDA días, sin contar
   * ventas anuladas (deleted_at).
   */
  private async conStockYDemanda(empresaId: string, productos: ProductoRecord[]): Promise<ProductoListado[]> {
    if (productos.length === 0) return [];
    const ids = Prisma.join(productos.map((p) => Prisma.sql`${p.id}::uuid`));
    const desde = new Date(Date.now() - DIAS_DEMANDA * 24 * 60 * 60 * 1000);
    const [stocks, ventas] = await Promise.all([
      this.prisma.$queryRaw<{ producto_id: string; stock: string }[]>(Prisma.sql`
        SELECT producto_id, SUM(cantidad * signo) AS stock
        FROM movimientos_inventario
        WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL AND producto_id IN (${ids})
        GROUP BY producto_id
      `),
      this.prisma.$queryRaw<{ producto_id: string; vendidos: string }[]>(Prisma.sql`
        SELECT i.producto_id, SUM(i.cantidad) AS vendidos
        FROM ventas_items i
        JOIN ventas v ON v.id = i.venta_id
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.fecha >= ${desde}
          AND i.producto_id IN (${ids})
        GROUP BY i.producto_id
      `),
    ]);
    const stock = new Map(stocks.map((f) => [f.producto_id, Number(f.stock)]));
    const vendidos = new Map(ventas.map((f) => [f.producto_id, Number(f.vendidos)]));
    const kits = await this.disponibilidadKits(empresaId, productos.map((p) => p.id));
    return productos.map((p) => ({ ...p, stock: kits.get(p.id) ?? stock.get(p.id) ?? 0, vendidos: vendidos.get(p.id) ?? 0, esKit: kits.has(p.id) }));
  }

  /**
   * Kits que se arman al vender (receta del producto, sin variante): no tienen
   * stock propio; "disponible" = cuántos se pueden armar con el stock de sus componentes.
   */
  private async disponibilidadKits(empresaId: string, ids: string[]): Promise<Map<string, number>> {
    const recetas = await this.prisma.receta.findMany({ where: { empresaId, deletedAt: null, armarAlVender: true, varianteId: null, productoId: { in: ids } }, include: { items: true } });
    if (recetas.length === 0) return new Map();
    const compIds = [...new Set(recetas.flatMap((r) => r.items.map((i) => i.insumoId)))];
    const filas = await this.prisma.movimientoInventario.groupBy({
      by: ['productoId', 'varianteId', 'signo'],
      where: { empresaId, deletedAt: null, productoId: { in: compIds }, tipo: { not: 'transferencia' } },
      _sum: { cantidad: true },
    });
    const stock = new Map<string, number>();
    for (const f of filas) {
      const k = `${f.productoId}:${f.varianteId ?? ''}`;
      stock.set(k, (stock.get(k) ?? 0) + (f._sum.cantidad?.toNumber() ?? 0) * f.signo);
    }
    return new Map(
      recetas.map((r) => [
        r.productoId,
        r.items.length ? Math.max(0, Math.min(...r.items.map((i) => Math.floor((stock.get(`${i.insumoId}:${i.insumoVarianteId ?? ''}`) ?? 0) / i.cantidad.toNumber())))) : 0,
      ]),
    );
  }

  async listarNombres(empresaId: string): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.producto.findMany({
      where: { empresaId, deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async guardarCodigoBarra(
    empresaId: string,
    id: string,
    codigoBarra: string | null,
  ): Promise<ProductoRecord | null | { duplicadoDe: string }> {
    const existente = await this.prisma.producto.findFirst({ where: { id, empresaId } });
    if (!existente) return null;
    // Un mismo código en dos productos haría que el escáner agregue el equivocado.
    if (codigoBarra) {
      const otro = await this.prisma.producto.findFirst({
        where: { empresaId, codigoBarra, deletedAt: null, id: { not: id } },
        select: { nombre: true },
      });
      if (otro) return { duplicadoDe: otro.nombre };
    }
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
