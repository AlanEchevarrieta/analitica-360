import { Injectable } from '@nestjs/common';
import { Prisma, type ProductoVariante } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  RepartoStockError,
  SkuDuplicadoError,
  VarianteConStockError,
  type GuardarVarianteInput,
  type RepartoStock,
  type VarianteRecord,
  type VariantesRepository,
} from './variantes.repository.js';
import { mismaCombinacion, normalizarAtributos, promedioPonderado } from './variantes.util.js';
import { normalizarSku } from './sku.util.js';
import { repartirPorUbicacion } from './reparto.util.js';

/** Stock sin variante por ubicación (misma clave que el stock por ubicación de Inventario). */
const stockSinVariantePorUbicacion = (empresaId: string, productoId: string) => Prisma.sql`
  SELECT ubicacion, SUM(q) AS stock FROM (
    SELECT CASE
             WHEN tipo = 'transferencia' AND signo = -1 THEN ubicacion_origen
             WHEN tipo = 'transferencia' THEN ubicacion_destino
             ELSE COALESCE(ubicacion_destino, ubicacion_origen)
           END AS ubicacion,
           cantidad * signo AS q
    FROM movimientos_inventario
    WHERE empresa_id = ${empresaId}::uuid AND producto_id = ${productoId}::uuid AND variante_id IS NULL AND deleted_at IS NULL
  ) t
  GROUP BY ubicacion
`;

@Injectable()
export class PrismaVariantesRepository implements VariantesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(v: ProductoVariante): VarianteRecord {
    return {
      id: v.id,
      productoId: v.productoId,
      empresaId: v.empresaId,
      sku: v.sku,
      atributos: normalizarAtributos(v.atributos as Record<string, unknown>),
      precioVenta: v.precioVenta?.toNumber() ?? null,
      costo: v.costo?.toNumber() ?? null,
      activo: v.activo,
    };
  }

  async listarPorProducto(empresaId: string, productoId: string): Promise<VarianteRecord[] | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId } });
    if (!producto) return null;
    const [filas, stocks] = await Promise.all([
      this.prisma.productoVariante.findMany({
        where: { empresaId, productoId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.$queryRaw<{ variante_id: string; stock: string }[]>(Prisma.sql`
        SELECT variante_id, SUM(cantidad * signo) AS stock FROM movimientos_inventario
        WHERE empresa_id = ${empresaId}::uuid AND producto_id = ${productoId}::uuid
          AND variante_id IS NOT NULL AND deleted_at IS NULL
        GROUP BY variante_id
      `),
    ]);
    const stock = new Map(stocks.map((s) => [s.variante_id, Number(s.stock)]));
    return filas.map((v) => ({ ...this.toRecord(v), stock: stock.get(v.id) ?? 0 }));
  }

  async stockSinVariante(empresaId: string, productoId: string): Promise<number | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId }, select: { id: true } });
    if (!producto) return null;
    const filas = await this.prisma.$queryRaw<{ stock: string }[]>(stockSinVariantePorUbicacion(empresaId, productoId));
    return filas.reduce((acc, f) => acc + Number(f.stock), 0);
  }

  async guardarVariantesProducto(
    empresaId: string,
    productoId: string,
    variantes: GuardarVarianteInput[],
    opciones: { usuarioId: string; reparto?: RepartoStock[] },
  ): Promise<VarianteRecord[] | null> {
    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({ where: { id: productoId, empresaId } });
      if (!producto) return null;

      const actuales = await tx.productoVariante.findMany({ where: { empresaId, productoId, deletedAt: null } });

      // SKU cargados a mano: únicos en la empresa, entre productos y variantes.
      const skusLista = new Set<string>();
      for (const v of variantes) {
        const sku = normalizarSku(v.sku);
        if (!sku) continue;
        if (skusLista.has(sku)) throw new SkuDuplicadoError(sku, 'otra variante de este producto');
        skusLista.add(sku);
      }
      if (skusLista.size > 0) {
        const lista = [...skusLista];
        const [enProducto, enVariante] = await Promise.all([
          tx.producto.findFirst({ where: { empresaId, deletedAt: null, sku: { in: lista, mode: 'insensitive' } }, select: { nombre: true, sku: true } }),
          tx.productoVariante.findFirst({
            where: { empresaId, deletedAt: null, productoId: { not: productoId }, sku: { in: lista, mode: 'insensitive' } },
            select: { sku: true, producto: { select: { nombre: true } } },
          }),
        ]);
        if (enProducto) throw new SkuDuplicadoError(enProducto.sku!, enProducto.nombre);
        if (enVariante) throw new SkuDuplicadoError(enVariante.sku!, enVariante.producto.nombre);
      }
      const idsKeep = new Set<string>();
      // Variantes existentes que en este guardado quedan inactivas.
      const apagadasEnLista: string[] = [];

      for (const v of variantes) {
        const atributos = normalizarAtributos(v.atributos);
        const existente =
          (v.id ? actuales.find((f) => f.id === v.id) : undefined) ??
          actuales.find((f) =>
            mismaCombinacion(normalizarAtributos(f.atributos as Record<string, unknown>), atributos),
          );

        if (existente) {
          await tx.productoVariante.update({
            where: { id: existente.id },
            data: {
              // Vacío = conserva el que tenía (el automático no se pierde al editar).
              sku: normalizarSku(v.sku) ?? existente.sku,
              atributos,
              precioVenta: v.precioVenta,
              costo: v.costo,
              activo: v.activo,
            },
          });
          idsKeep.add(existente.id);
          if (!v.activo && existente.activo) apagadasEnLista.push(existente.id);
          continue;
        }

        const creada = await tx.productoVariante.create({
          data: {
            productoId,
            empresaId,
            sku: normalizarSku(v.sku),
            atributos,
            // Sin precio/costo propio hereda los del producto: si no, al agregar la
            // primera variante el producto se quedaba sin costo (y su stock valía $0).
            precioVenta: v.precioVenta ?? producto.precioVenta,
            costo: v.costo ?? producto.costo,
            activo: v.activo,
          },
        });
        idsKeep.add(creada.id);
      }

      // Nunca se borran (deletedAt no se toca) - las que no vinieron en la
      // lista se desactivan, igual que guardarVariantesProducto del legacy.
      const aDesactivar = actuales.filter((a) => !idsKeep.has(a.id)).map((a) => a.id);
      // Desactivar (o quitar) una variante que todavía tiene stock deja esas
      // unidades varadas: nadie las puede vender ni ver. Así se originó el
      // stock "fantasma" del legacy. Se exige dejarla en 0 antes.
      const idsApagadas = [
        ...aDesactivar,
        ...apagadasEnLista,
      ];
      if (idsApagadas.length > 0) {
        const conStock = await tx.$queryRaw<{ variante_id: string; stock: string }[]>(Prisma.sql`
          SELECT variante_id, SUM(cantidad * signo) AS stock FROM movimientos_inventario
          WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL
            AND variante_id IN (${Prisma.join(idsApagadas.map((x) => Prisma.sql`${x}::uuid`))})
          GROUP BY variante_id HAVING SUM(cantidad * signo) <> 0
        `);
        if (conStock.length > 0) {
          const etiqueta = (id: string) => {
            const a = actuales.find((f) => f.id === id);
            if (!a) return 'Variante';
            return Object.values(a.atributos as Record<string, string>).join(' / ') || a.sku || 'Variante';
          };
          // Tirar para que la transacción deshaga lo que ya se actualizó arriba.
          throw new VarianteConStockError(conStock.map((f) => ({ etiqueta: etiqueta(f.variante_id), stock: Number(f.stock) })));
        }
      }
      if (aDesactivar.length > 0) {
        await tx.productoVariante.updateMany({ where: { id: { in: aDesactivar } }, data: { activo: false } });
      }

      const activas = await tx.productoVariante.findMany({
        where: { empresaId, productoId, deletedAt: null, activo: true },
      });

      // Stock sin variante: con variantes activas nadie lo podría vender ni ver
      // (así quedó varado el del Bolso Matero). Se exige repartirlo.
      if (activas.length > 0) {
        const porUbicacion = (await tx.$queryRaw<{ ubicacion: string | null; stock: string }[]>(stockSinVariantePorUbicacion(empresaId, productoId))).map(
          (f) => ({ ubicacion: f.ubicacion, stock: Number(f.stock) }),
        );
        const total = porUbicacion.reduce((acc, f) => acc + f.stock, 0);
        if (total < 0) throw new RepartoStockError('stock_negativo', total);
        if (total > 0) {
          const reparto = opciones.reparto ?? [];
          if (reparto.length === 0) throw new RepartoStockError('reparto_requerido', total);
          if (reparto.reduce((acc, r) => acc + r.cantidad, 0) !== total) throw new RepartoStockError('reparto_no_suma', total);
          const destinos = reparto.map((r) => {
            const atributos = normalizarAtributos(r.atributos);
            const variante = activas.find((a) => mismaCombinacion(normalizarAtributos(a.atributos as Record<string, unknown>), atributos));
            if (!variante) throw new RepartoStockError('reparto_variante_invalida', total);
            return { varianteId: variante.id, cantidad: r.cantidad };
          });
          const motivo = 'Reparto del stock sin variante entre las variantes';
          for (const t of repartirPorUbicacion(porUbicacion, destinos)) {
            const base = { empresaId, productoId, usuarioId: opciones.usuarioId, cantidad: t.cantidad, costoUnitario: producto.costo, motivo };
            await tx.movimientoInventario.createMany({
              data: [
                { ...base, varianteId: null, tipo: 'ajuste_negativo', signo: -1, ubicacionOrigen: t.ubicacion },
                { ...base, varianteId: t.varianteId, tipo: 'ajuste_positivo', signo: 1, ubicacionDestino: t.ubicacion },
              ],
            });
          }
        }
      }

      // Regla del schema (ver comentario en el modelo ProductoVariante):
      // costo/precioVenta de Producto = promedio ponderado de las variantes
      // activas. Si no queda ninguna activa, NO se pisan costo/precioVenta
      // (podrían ser el precio base propio del producto, cargado desde
      // ProductosModule) - solo se apaga usaVariantes.
      if (activas.length > 0) {
        const costo = promedioPonderado(
          activas.filter((a) => a.costo != null).map((a) => ({ valor: a.costo!.toNumber(), stock: 0 })),
        );
        const precioVenta = promedioPonderado(
          activas.filter((a) => a.precioVenta != null).map((a) => ({ valor: a.precioVenta!.toNumber(), stock: 0 })),
        );
        await tx.producto.update({ where: { id: productoId }, data: { usaVariantes: true, costo, precioVenta } });
        const cambioPrecio =
          (producto.costo?.toNumber() ?? null) !== costo || (producto.precioVenta?.toNumber() ?? null) !== precioVenta;
        if (cambioPrecio && costo != null && precioVenta != null) {
          await tx.precioHistorial.create({ data: { empresaId, productoId, precioVenta, costo } });
        }
      } else {
        await tx.producto.update({ where: { id: productoId }, data: { usaVariantes: false } });
      }

      const filas = await tx.productoVariante.findMany({
        where: { empresaId, productoId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return filas.map((v) => this.toRecord(v));
    });
  }
}
