import { claveColumna, enteroCelda, numeroCelda, textoCelda } from './excel.util.js';

/** Puerto de COLUMNAS_PLANTILLA (src/lib/importarProductos.ts) - referencia para el frontend, no genera un archivo acá. */
export const COLUMNAS_PLANTILLA = ['Nombre', 'Categoría', 'Precio de venta', 'Costo', 'Stock inicial'] as const;

/** Puerto de LOTE_IMPORTACION (src/lib/lotesImportacion.ts) - tamaño de lote para no mandar todo en una sola tanda. */
export const LOTE_IMPORTACION = 50;

export interface FilaImportacionProducto {
  nombre: string;
  categoria: string;
  precioVenta: number;
  costo: number;
  stockInicial: number;
}

/** Puerto de mapaColumnas: matchea encabezados por contenido, no por posición fija. */
function mapaColumnas(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const k = claveColumna(h);
    if (k === 'nombre') idx.nombre = i;
    if (k === 'categoria') idx.categoria = i;
    if (k.includes('precio')) idx.precio = i;
    if (k === 'costo') idx.costo = i;
    if (k.includes('stock')) idx.stock = i;
  });
  return idx;
}

/** Puerto de filasDesdeMatriz: primera fila = encabezados, resto = datos. Filas sin nombre se descartan. */
export function filasDesdeMatriz(rows: unknown[][]): FilaImportacionProducto[] {
  if (rows.length === 0) return [];
  const headers = (rows[0] ?? []).map((h) => textoCelda(h));
  const idx = mapaColumnas(headers);
  const nombreIdx = idx.nombre ?? 0;
  const out: FilaImportacionProducto[] = [];
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) continue;
    const nombre = textoCelda(row[nombreIdx]);
    if (!nombre) continue;
    out.push({
      nombre,
      categoria: textoCelda(row[idx.categoria ?? 1]),
      precioVenta: numeroCelda(row[idx.precio ?? 2]),
      costo: numeroCelda(row[idx.costo ?? 3]),
      stockInicial: enteroCelda(row[idx.stock ?? 4]),
    });
  }
  return out;
}

/** Puerto de partirEnLotes (src/lib/lotesImportacion.ts). */
export function partirEnLotes<T>(filas: T[], tamano = LOTE_IMPORTACION): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < filas.length; i += tamano) out.push(filas.slice(i, i + tamano));
  return out;
}
