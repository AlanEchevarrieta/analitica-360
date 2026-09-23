import type { FilaImportacionProducto } from './productos-import.util.js';

export type ResultadoCrearImportado = { ok: true } | { ok: false; motivo: string };

export const PRODUCTOS_IMPORT_REPOSITORY = Symbol('PRODUCTOS_IMPORT_REPOSITORY');

/**
 * Puerto de creación de productos vía importación - equivalente a la
 * función SQL real crear_producto() (última definición en
 * supabase/008_cuotas_y_precio_actual.sql, sin redefiniciones
 * posteriores): producto (con `categoria` en texto libre, no categoriaId -
 * fiel a lo que la importación por planilla siempre soportó) + fila inicial
 * en precios_historial + movimiento 'ajuste_positivo' si stockInicial > 0.
 *
 * Deliberadamente separado de ProductosModule: su `crear()` solo soporta
 * categoriaId (FK) y no maneja stockInicial - es un flujo distinto (alta
 * manual con categoría existente) del de importación masiva (categoría en
 * texto libre tal cual viene de la planilla, como en el legacy).
 */
export interface ProductosImportRepository {
  /** Nombres (sin normalizar) de todos los productos no eliminados de la empresa - para deduplicar contra el archivo. */
  nombresExistentes(empresaId: string): Promise<string[]>;
  crear(empresaId: string, usuarioId: string, fila: FilaImportacionProducto): Promise<ResultadoCrearImportado>;
}
