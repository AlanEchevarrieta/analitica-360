import type { Prisma } from '@prisma/client';
import { expandirKits, type ItemSalida } from './produccion.util.js';

/**
 * Para ventas y devoluciones: los kits "que se arman al vender" no tienen
 * stock propio, así que el movimiento de stock se hace sobre sus componentes.
 * Devuelve, por item, las salidas a registrar y (si es kit) su costo por
 * unidad = suma de los costos vigentes de sus componentes.
 */
export async function salidasConKits(tx: Prisma.TransactionClient, empresaId: string, items: ItemSalida[]) {
  const productoIds = [...new Set(items.map((i) => i.productoId))];
  const recetas = productoIds.length
    ? await tx.receta.findMany({ where: { empresaId, deletedAt: null, armarAlVender: true, productoId: { in: productoIds } }, include: { items: true } })
    : [];
  const expandidos = expandirKits(
    items,
    recetas.map((r) => ({ productoId: r.productoId, varianteId: r.varianteId, componentes: r.items.map((i) => ({ insumoId: i.insumoId, insumoVarianteId: i.insumoVarianteId, cantidad: i.cantidad.toNumber() })) })),
  );
  if (recetas.length === 0) return expandidos.map((e) => ({ ...e, costoKit: null as number | null }));

  const compIds = [...new Set(expandidos.filter((e) => e.esKit).flatMap((e) => e.salidas.map((s) => s.productoId)))];
  const comps = await tx.producto.findMany({ where: { empresaId, id: { in: compIds } }, select: { id: true, costo: true, variantes: { select: { id: true, costo: true } } } });
  const costo = (s: ItemSalida) => {
    const p = comps.find((c) => c.id === s.productoId);
    const v = s.varianteId ? p?.variantes.find((x) => x.id === s.varianteId) : null;
    return v?.costo?.toNumber() ?? p?.costo?.toNumber() ?? 0;
  };
  return expandidos.map((e) => ({
    ...e,
    costoKit: e.esKit ? Math.round((e.salidas.reduce((a, s) => a + s.cantidad * costo(s), 0) / e.original.cantidad) * 100) / 100 : null,
  }));
}
