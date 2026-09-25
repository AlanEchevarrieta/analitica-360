import { Prisma } from '@prisma/client';

/**
 * Costo promedio ponderado (PPP): cada entrada de mercadería actualiza el
 * costo del producto/variante mezclando el stock que ya había con lo que
 * entra. Ese costo es el que VentasRepository congela en VentaItem.costoUnitario,
 * así que la ganancia por venta refleja lo que realmente costó la mercadería.
 */

export interface EntradaCosto {
  productoId: string;
  varianteId: string | null;
  cantidad: number;
  /** Costo unitario real: factura + parte proporcional de flete/impuestos/otros. */
  costoUnitario: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Reparte los costos adicionales de una compra (flete, impuestos, otros)
 * entre los ítems en proporción a su subtotal y devuelve el costo unitario
 * real de cada ítem, en el mismo orden.
 */
export function costoUnitarioConAdicionales(
  items: { cantidad: number; costoUnitario: number }[],
  totalAdicionales: number,
): number[] {
  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
  if (totalAdicionales <= 0 || subtotal <= 0) return items.map((i) => i.costoUnitario);
  return items.map((i) => {
    const parte = (i.cantidad * i.costoUnitario * totalAdicionales) / subtotal;
    return redondear(i.costoUnitario + parte / i.cantidad);
  });
}

/**
 * (stock previo × costo previo + cantidad × costo nuevo) / (stock previo + cantidad).
 * Un stock previo negativo o sin costo conocido no pondera: el costo pasa a
 * ser directamente el de la entrada.
 */
export function costoPromedioPonderado(
  stockPrevio: number,
  costoPrevio: number | null,
  cantidad: number,
  costoNuevo: number,
): number {
  const stock = Math.max(0, stockPrevio);
  if (!costoPrevio || costoPrevio <= 0 || stock === 0) return redondear(costoNuevo);
  return redondear((stock * costoPrevio + cantidad * costoNuevo) / (stock + cantidad));
}

/** Junta entradas del mismo producto/variante en una sola, con su costo promedio. */
export function agruparEntradas(entradas: EntradaCosto[]): EntradaCosto[] {
  const porClave = new Map<string, EntradaCosto>();
  for (const e of entradas) {
    const clave = `${e.productoId}:${e.varianteId ?? ''}`;
    const previa = porClave.get(clave);
    if (!previa) {
      porClave.set(clave, { ...e });
      continue;
    }
    const cantidad = previa.cantidad + e.cantidad;
    previa.costoUnitario = redondear((previa.cantidad * previa.costoUnitario + e.cantidad * e.costoUnitario) / cantidad);
    previa.cantidad = cantidad;
  }
  return [...porClave.values()];
}

/**
 * Actualiza el costo (PPP) de cada producto/variante que entra y deja el
 * registro en precios_historial. Debe llamarse dentro de la transacción de
 * la compra y ANTES de crear sus movimientos de inventario (usa el stock
 * previo a la entrada).
 */
export async function aplicarCostoPromedio(
  tx: Prisma.TransactionClient,
  empresaId: string,
  entradas: EntradaCosto[],
  fecha: Date,
): Promise<void> {
  for (const e of agruparEntradas(entradas)) {
    if (e.cantidad <= 0) continue;
    const [{ stock }] = await tx.$queryRaw<{ stock: string | null }[]>(Prisma.sql`
      SELECT SUM(cantidad * signo) AS stock FROM movimientos_inventario
      WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL AND producto_id = ${e.productoId}::uuid
        AND ${e.varianteId ? Prisma.sql`variante_id = ${e.varianteId}::uuid` : Prisma.sql`variante_id IS NULL`}
    `);

    const producto = await tx.producto.findFirst({ where: { id: e.productoId, empresaId } });
    if (!producto) continue;
    const variante = e.varianteId
      ? await tx.productoVariante.findFirst({ where: { id: e.varianteId, empresaId } })
      : null;

    const costoPrevio = (variante?.costo ?? producto.costo)?.toNumber() ?? null;
    const costo = costoPromedioPonderado(Number(stock ?? 0), costoPrevio, e.cantidad, e.costoUnitario);

    if (variante) {
      await tx.productoVariante.update({ where: { id: variante.id }, data: { costo } });
    } else {
      await tx.producto.update({ where: { id: producto.id }, data: { costo } });
    }
    await tx.precioHistorial.create({
      data: {
        empresaId,
        productoId: producto.id,
        variante: variante?.id ?? null,
        precioVenta: (variante?.precioVenta ?? producto.precioVenta)?.toNumber() ?? 0,
        costo,
        fechaDesde: fecha,
      },
    });
  }
}
