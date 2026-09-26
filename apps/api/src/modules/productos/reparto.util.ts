export interface Tramo {
  varianteId: string;
  ubicacion: string | null;
  cantidad: number;
}

/**
 * Reparte el stock sin variante entre las variantes elegidas respetando dónde
 * está cada unidad: se va llenando cada variante con el stock de las
 * ubicaciones que tienen unidades, de la que más tiene a la que menos.
 */
export function repartirPorUbicacion(
  porUbicacion: { ubicacion: string | null; stock: number }[],
  destinos: { varianteId: string; cantidad: number }[],
): Tramo[] {
  const baldes = porUbicacion
    .filter((b) => b.stock > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.stock - a.stock);
  const tramos: Tramo[] = [];
  for (const d of destinos) {
    let falta = d.cantidad;
    for (const b of baldes) {
      if (falta === 0) break;
      const toma = Math.min(falta, b.stock);
      if (toma <= 0) continue;
      tramos.push({ varianteId: d.varianteId, ubicacion: b.ubicacion, cantidad: toma });
      b.stock -= toma;
      falta -= toma;
    }
  }
  return tramos;
}
