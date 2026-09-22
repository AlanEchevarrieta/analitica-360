export interface MovimientoRecord {
  id: string;
  productoId: string;
  varianteId: string | null;
  loteId: string | null;
  usuarioId: string;
  tipo: string;
  cantidad: number;
  signo: 1 | -1;
  costoUnitario: number | null;
  precioUnitario: number | null;
  motivo: string | null;
  ubicacionOrigen: string | null;
  ubicacionDestino: string | null;
  referenciaId: string | null;
  fecha: Date;
}

export interface CrearMovimientoInput {
  productoId: string;
  varianteId?: string | null;
  loteId?: string | null;
  usuarioId: string;
  tipo: string;
  cantidad: number;
  signo: 1 | -1;
  costoUnitario?: number | null;
  precioUnitario?: number | null;
  motivo?: string | null;
  ubicacionOrigen?: string | null;
  ubicacionDestino?: string | null;
  referenciaId?: string | null;
}

export interface MovimientoKardexRecord extends MovimientoRecord {
  saldo: number;
  usuarioNombre: string;
  ventaFecha: Date | null;
  varianteEtiqueta: string | null;
  numeroLote: string | null;
}

export type ResultadoCrearMovimiento =
  | { ok: true; movimiento: MovimientoRecord }
  | { ok: false; motivo: 'producto_no_encontrado' | 'variante_invalida' };

export type ResultadoTraslado =
  | { ok: true; movimientos: [MovimientoRecord, MovimientoRecord] }
  | { ok: false; motivo: 'ubicacion_invalida' | 'producto_no_encontrado' | 'stock_insuficiente' };

export const MOVIMIENTOS_REPOSITORY = Symbol('MOVIMIENTOS_REPOSITORY');

/** Puerto de persistencia de MovimientoInventario. Implementación real: PrismaMovimientosRepository. */
export interface MovimientosRepository {
  /** `variante_invalida` si `varianteId` viene seteado y no pertenece a este producto/empresa (aislamiento multi-tenant). */
  crear(empresaId: string, input: CrearMovimientoInput): Promise<ResultadoCrearMovimiento>;
  /**
   * Crea el par de filas signo -1/+1 que representa la transferencia (ver
   * comentario en el schema), validando producto/ubicaciones y stock
   * suficiente en origen dentro de una única transacción interactiva -
   * evita la ventana de carrera de validar fuera del `$transaction`.
   */
  registrarTraslado(
    empresaId: string,
    usuarioId: string,
    input: { productoId: string; cantidad: number; origen: string; destino: string; motivo: string | null; fecha: Date },
  ): Promise<ResultadoTraslado>;
  listarKardex(
    empresaId: string,
    productoId: string,
    filtro: { pagina: number; pageSize: number },
  ): Promise<{ filas: MovimientoKardexRecord[]; total: number } | null>;
  calcularStockActual(empresaId: string, productoId: string, varianteId?: string | null): Promise<number>;
}
