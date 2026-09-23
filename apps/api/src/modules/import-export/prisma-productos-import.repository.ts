import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { ProductosImportRepository, ResultadoCrearImportado } from './productos-import.repository.js';
import type { FilaImportacionProducto } from './productos-import.util.js';

@Injectable()
export class PrismaProductosImportRepository implements ProductosImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nombresExistentes(empresaId: string): Promise<string[]> {
    const productos = await this.prisma.producto.findMany({ where: { empresaId, deletedAt: null }, select: { nombre: true } });
    return productos.map((p) => p.nombre);
  }

  async crear(empresaId: string, usuarioId: string, fila: FilaImportacionProducto): Promise<ResultadoCrearImportado> {
    const nombre = fila.nombre.trim();
    if (!nombre) return { ok: false, motivo: 'Nombre obligatorio' };
    if (!(fila.precioVenta >= 0)) return { ok: false, motivo: 'Precio inválido' };
    const costo = fila.costo >= 0 ? fila.costo : 0;
    if (fila.costo < 0) return { ok: false, motivo: 'Costo inválido' };
    const stockInicial = Math.max(0, Math.trunc(fila.stockInicial));

    try {
      await this.prisma.$transaction(async (tx) => {
        const producto = await tx.producto.create({
          data: {
            empresaId,
            nombre,
            categoria: fila.categoria.trim() || null,
            activo: true,
            precioVenta: fila.precioVenta,
            costo,
          },
        });
        await tx.precioHistorial.create({
          data: { empresaId, productoId: producto.id, precioVenta: fila.precioVenta, costo },
        });
        if (stockInicial > 0) {
          await tx.movimientoInventario.create({
            data: {
              empresaId,
              productoId: producto.id,
              usuarioId,
              tipo: 'ajuste_positivo',
              cantidad: stockInicial,
              signo: 1,
              costoUnitario: costo,
              motivo: 'Stock inicial',
            },
          });
        }
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'Error' };
    }
  }
}
