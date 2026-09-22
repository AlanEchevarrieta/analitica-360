export interface AtributoRecord {
  id: string;
  empresaId: string;
  nombre: string;
  valores: string[];
  activoVentas: boolean;
}

export interface GuardarAtributoInput {
  nombre: string;
  valores: string[];
  activoVentas: boolean;
}

export const ATRIBUTOS_REPOSITORY = Symbol('ATRIBUTOS_REPOSITORY');

/** Puerto de persistencia de Atributo (catálogo de Color/Talle/etc). */
export interface AtributosRepository {
  listar(empresaId: string): Promise<AtributoRecord[]>;
  crear(empresaId: string, input: GuardarAtributoInput): Promise<AtributoRecord>;
  actualizar(empresaId: string, id: string, input: GuardarAtributoInput): Promise<AtributoRecord | null>;
  eliminar(empresaId: string, id: string): Promise<boolean>;
}
