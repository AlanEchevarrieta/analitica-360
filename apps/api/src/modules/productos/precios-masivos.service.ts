import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { margenPct, precioNuevo, type ReglaAumento } from './precios-masivos.util.js';
import { normalizarAtributos, promedioPonderado } from './variantes.util.js';

export interface LineaPrecio {
  productoId: string;
  varianteId: string | null;
  nombre: string;
  variante: string | null;
  costo: number | null;
  precioActual: number | null;
  precioNuevo: number | null;
  margenActual: number | null;
  margenNuevo: number | null;
  /** Por qué no se puede calcular (se deja como está). */
  omitido: 'sin_precio' | 'sin_costo' | null;
}

export interface ResultadoPreciosMasivos {
  lineas: LineaPrecio[];
  cambian: number;
  omitidos: number;
  aplicado: boolean;
}

const num = (d: { toNumber(): number } | null | undefined) => (d == null ? null : d.toNumber());

@Injectable()
export class PreciosMasivosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcula (y si `confirmar`, guarda) los precios nuevos de los productos activos del alcance. */
  async ejecutar(empresaId: string, categoriaId: string | null, regla: ReglaAumento, confirmar: boolean): Promise<ResultadoPreciosMasivos> {
    const productos = await this.prisma.producto.findMany({
      where: { empresaId, deletedAt: null, activo: true, ...(categoriaId ? { categoriaId } : {}) },
      select: {
        id: true,
        nombre: true,
        precioVenta: true,
        costo: true,
        usaVariantes: true,
        variantes: { where: { deletedAt: null, activo: true }, select: { id: true, atributos: true, precioVenta: true, costo: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { nombre: 'asc' },
    });

    const lineas: LineaPrecio[] = [];
    const linea = (productoId: string, varianteId: string | null, nombre: string, variante: string | null, actual: number | null, costo: number | null): LineaPrecio => {
      const nuevo = precioNuevo(actual, costo, regla);
      const omitido = nuevo != null ? null : regla.modo === 'margen' ? 'sin_costo' : 'sin_precio';
      return { productoId, varianteId, nombre, variante, costo, precioActual: actual, precioNuevo: nuevo, margenActual: margenPct(actual, costo), margenNuevo: margenPct(nuevo, costo), omitido };
    };
    for (const p of productos) {
      if (p.usaVariantes && p.variantes.length > 0) {
        for (const v of p.variantes) {
          const etiqueta = Object.values(normalizarAtributos(v.atributos as Record<string, unknown>)).join(' / ');
          // Sin precio/costo propio, la variante usa los del producto.
          lineas.push(linea(p.id, v.id, p.nombre, etiqueta, num(v.precioVenta) ?? num(p.precioVenta), num(v.costo) ?? num(p.costo)));
        }
      } else {
        lineas.push(linea(p.id, null, p.nombre, null, num(p.precioVenta), num(p.costo)));
      }
    }
    const cambian = lineas.filter((l) => l.precioNuevo != null && l.precioNuevo !== l.precioActual);

    if (confirmar && cambian.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const p of productos) {
          const propias = cambian.filter((l) => l.productoId === p.id);
          if (propias.length === 0) continue;
          let precioProducto: number | null;
          if (p.usaVariantes && p.variantes.length > 0) {
            for (const l of propias) await tx.productoVariante.update({ where: { id: l.varianteId! }, data: { precioVenta: l.precioNuevo } });
            // Igual que al guardar variantes: el precio del producto es el promedio de sus variantes activas.
            const precios = lineas.filter((l) => l.productoId === p.id).map((l) => ({ valor: (l.precioNuevo ?? l.precioActual) ?? 0, stock: 0 }));
            precioProducto = promedioPonderado(precios);
          } else {
            precioProducto = propias[0].precioNuevo;
          }
          await tx.producto.update({ where: { id: p.id }, data: { precioVenta: precioProducto } });
          const costo = num(p.costo);
          if (precioProducto != null && costo != null) {
            await tx.precioHistorial.create({ data: { empresaId, productoId: p.id, precioVenta: precioProducto, costo } });
          }
        }
      });
    }
    return { lineas, cambian: cambian.length, omitidos: lineas.filter((l) => l.omitido).length, aplicado: confirmar && cambian.length > 0 };
  }
}
