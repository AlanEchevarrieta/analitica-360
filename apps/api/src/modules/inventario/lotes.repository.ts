import type { EstadoLote } from './inventario.util.js';

export interface LoteRecord {
  id: string;
  empresaId: string;
  productoId: string;
  productoNombre: string;
  varianteId: string | null;
  varianteEtiqueta: string | null;
  numeroLote: string;
  fechaVencimiento: string | null;
  fechaElaboracion: string | null;
  cantidadInicial: number;
  stock: number;
  proveedorId: string | null;
  proveedorNombre: string | null;
  notas: string | null;
  activo: boolean;
  estado: EstadoLote;
}

export interface CrearLoteInput {
  productoId: string;
  varianteId?: string | null;
  numeroLote: string;
  fechaVencimiento?: string | null;
  fechaElaboracion?: string | null;
  cantidadInicial: number;
  proveedorId?: string | null;
  notas?: string | null;
  registrarMovimiento?: boolean;
}

export type ResultadoCrearLote =
  | { ok: true; lote: LoteRecord }
  | { ok: false; motivo: 'producto_no_encontrado' | 'variante_invalida' | 'proveedor_invalido' };

export const LOTES_REPOSITORY = Symbol('LOTES_REPOSITORY');

/** Puerto de persistencia de Lote. Implementación real: PrismaLotesRepository. */
export interface LotesRepository {
  listarPorProducto(empresaId: string, productoId: string): Promise<LoteRecord[] | null>;
  /**
   * Si `registrarMovimiento` y `cantidadInicial > 0`, agrega un
   * MovimientoInventario 'ajuste_positivo' (stock inicial del lote), en la
   * misma transacción - puerto de crearLote() del legacy. `variante_invalida`/
   * `proveedor_invalido` si esos ids no pertenecen a este producto/empresa
   * (aislamiento multi-tenant).
   */
  crear(empresaId: string, usuarioId: string, input: CrearLoteInput): Promise<ResultadoCrearLote>;
  sugerenciaNumero(empresaId: string, prefijo: string): Promise<number>;
  /** Lotes con stock > 0 para un producto/variante, ordenados por vencimiento más próximo primero (FEFO). */
  disponibles(empresaId: string, productoId: string, varianteId: string | null): Promise<LoteRecord[]>;
}
