export type TipoUbicacion = 'deposito' | 'local' | 'stand' | 'feria' | 'otro';

export interface UbicacionRecord {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoUbicacion;
  activo: boolean;
}

export interface GuardarUbicacionInput {
  nombre: string;
  descripcion: string | null;
  tipo: TipoUbicacion;
  activo: boolean;
}

export type ResultadoGuardarUbicacion =
  | { ok: true; ubicacion: UbicacionRecord }
  | { ok: false; motivo: 'no_encontrada' | 'nombre_duplicado' };

export const UBICACIONES_REPOSITORY = Symbol('UBICACIONES_REPOSITORY');

/** Puerto de persistencia de Ubicacion. Implementación real: PrismaUbicacionesRepository. */
export interface UbicacionesRepository {
  listar(empresaId: string, soloActivas: boolean): Promise<UbicacionRecord[]>;
  /** `nombre_duplicado` si ya existe una ubicación con ese nombre en la empresa (`@@unique([empresaId, nombre])`). */
  crear(empresaId: string, input: GuardarUbicacionInput): Promise<ResultadoGuardarUbicacion>;
  actualizar(empresaId: string, id: string, input: GuardarUbicacionInput): Promise<ResultadoGuardarUbicacion>;
  buscarPorId(empresaId: string, id: string): Promise<UbicacionRecord | null>;
  /**
   * false si no existe en esta empresa. Lanza con un mensaje de dominio (no
   * un error técnico) si tiene movimientos registrados - ubicacionOrigen/
   * Destino son texto libre en MovimientoInventario (no FK), así que se
   * busca por nombre, igual que eliminarUbicacion() del legacy.
   */
  eliminar(empresaId: string, id: string): Promise<'ok' | 'no_encontrada' | 'tiene_movimientos'>;
}
