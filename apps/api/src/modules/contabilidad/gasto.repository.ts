export type CategoriaGasto = 'alquiler' | 'sueldos' | 'servicios' | 'marketing' | 'logistica' | 'impuestos' | 'mantenimiento' | 'otro';
export type FrecuenciaGasto = 'mensual' | 'quincenal' | 'semanal';

export const CATEGORIAS_GASTO: CategoriaGasto[] = ['alquiler', 'sueldos', 'servicios', 'marketing', 'logistica', 'impuestos', 'mantenimiento', 'otro'];
export const FRECUENCIAS_GASTO: FrecuenciaGasto[] = ['mensual', 'quincenal', 'semanal'];

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
}

export type ResultadoAnularGasto = { ok: true } | { ok: false; motivo: 'no_encontrado' | 'ya_anulado' };

export const GASTO_REPOSITORY = Symbol('GASTO_REPOSITORY');

/** Puerto fiel de src/lib/gastos.ts (listarGastos/crearGasto/anularGasto), tabla `gastos` (supabase/061_contabilidad.sql). */
export interface GastoRepository {
  listar(empresaId: string, desde: string, hasta: string, categoria?: CategoriaGasto): Promise<Gasto[]>;
  crear(input: CrearGastoInput): Promise<Gasto>;
  anular(empresaId: string, id: string): Promise<ResultadoAnularGasto>;
}
