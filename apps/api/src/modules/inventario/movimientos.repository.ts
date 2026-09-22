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

export type ResultadoTraslado =
  | { ok: true; movimientos: [MovimientoRecord, MovimientoRecord] }
  | { ok: false; motivo: 'ubicacion_invalida' | 'producto_no_encontrado' };

export const MOVIMIENTOS_REPOSITORY = Symbol('MOVIMIENTOS_REPOSITORY');

/** Puerto de persistencia de MovimientoInventario. Implementación real: PrismaMovimientosRepository. */
export interface MovimientosRepository {
  crear(empresaId: string, input: CrearMovimientoInput): Promise<MovimientoRecord | null>;
  /** Crea el par de filas signo -1/+1 que representa la transferencia (ver comentario en el schema). */
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
