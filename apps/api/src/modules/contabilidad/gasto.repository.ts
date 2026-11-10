export type CategoriaGasto = 'alquiler' | 'sueldos' | 'servicios' | 'marketing' | 'logistica' | 'impuestos' | 'mantenimiento' | 'otro';
export type FrecuenciaGasto = 'mensual' | 'quincenal' | 'semanal';

export const CATEGORIAS_GASTO: CategoriaGasto[] = ['alquiler', 'sueldos', 'servicios', 'marketing', 'logistica', 'impuestos', 'mantenimiento', 'otro'];
export const FRECUENCIAS_GASTO: FrecuenciaGasto[] = ['mensual', 'quincenal', 'semanal'];
export type TipoCosto = 'fijo' | 'variable';
export const TIPOS_COSTO: TipoCosto[] = ['fijo', 'variable'];

export interface Gasto {
  id: string;
  empresaId: string;
  usuarioId: string | null;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;
  fecha: string;
  recurrente: boolean;
  frecuencia: FrecuenciaGasto | null;
  fechaFin: string | null;
  tipoCosto: TipoCosto;
}

export interface CrearGastoInput {
  empresaId: string;
  usuarioId: string;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;
  fecha: string;
  recurrente: boolean;
  frecuencia: FrecuenciaGasto | null;
  tipoCosto: TipoCosto;
}

export interface EditarGastoInput {
  categoria?: CategoriaGasto;
  descripcion?: string;
  monto?: number;
  fecha?: string;
}

export type ResultadoAnularGasto = { ok: true } | { ok: false; motivo: 'no_encontrado' | 'ya_anulado' };

export const GASTO_REPOSITORY = Symbol('GASTO_REPOSITORY');

/** Puerto fiel de src/lib/gastos.ts (listarGastos/crearGasto/anularGasto), tabla `gastos` (supabase/061_contabilidad.sql). */
export interface GastoRepository {
  listar(empresaId: string, desde: string, hasta: string, categoria?: CategoriaGasto): Promise<Gasto[]>;
  crear(input: CrearGastoInput): Promise<Gasto>;
  editar(empresaId: string, id: string, input: EditarGastoInput): Promise<Gasto | null>;
  dejarDeRepetir(empresaId: string, id: string, fechaFin: string): Promise<Gasto | null>;
  cambiarMontoDesde(empresaId: string, usuarioId: string, id: string, desde: string, fechaFinViejo: string, monto: number): Promise<Gasto | null>;
  anular(empresaId: string, id: string): Promise<ResultadoAnularGasto>;
  /** false si no existe. */
  cambiarTipoCosto(empresaId: string, id: string, tipoCosto: TipoCosto): Promise<boolean>;
}
