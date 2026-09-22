export interface CategoriaRecord {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface CrearCategoriaInput {
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export type ActualizarCategoriaInput = Omit<CrearCategoriaInput, 'empresaId'>;

export type ResultadoGuardarCategoria =
  | { ok: true; categoria: CategoriaRecord }
  | { ok: false; motivo: 'no_encontrada' | 'nombre_duplicado' };

export const CATEGORIAS_REPOSITORY = Symbol('CATEGORIAS_REPOSITORY');

/** Puerto de persistencia de Categoria. Implementación real: PrismaCategoriasRepository. */
export interface CategoriasRepository {
  /** `nombre_duplicado` si ya existe una categoría con ese nombre en la empresa (`@@unique([empresaId, nombre])`). */
  crear(input: CrearCategoriaInput): Promise<ResultadoGuardarCategoria>;
  actualizar(empresaId: string, id: string, input: ActualizarCategoriaInput): Promise<ResultadoGuardarCategoria>;
  /** Desvincula los productos que apuntaban a esta categoría y la elimina. false si no existía en esta empresa. */
  eliminar(empresaId: string, id: string): Promise<boolean>;
  listar(empresaId: string, soloActivas: boolean): Promise<CategoriaRecord[]>;
  buscarPorId(empresaId: string, id: string): Promise<CategoriaRecord | null>;
}
