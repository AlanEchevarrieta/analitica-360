import type { ActualizarConfiguracionInput } from './configuracion.dto.js';

export interface TasaCuota {
  cuotas: number;
  tasa: number;
  label: string;
  activo: boolean;
  personalizada: boolean;
}

/** Configuración de la empresa tal como la edita la pantalla de Configuración. */
export interface ConfiguracionRecord {
  mediosPago: string[];
  tasasCuotas: TasaCuota[];
  mostrarCliente: 'siempre' | 'opcional' | 'no_mostrar';
  crearClienteDesdeVenta: boolean;
  umbralStockBajo: number;
  ubicacionVentaDefault: string | null;
  remitente: { nombre: string | null; direccion: string | null; telefono: string | null; email: string | null };
  modoAsignacion: 'manual' | 'round_robin' | 'todo_a_uno';
  asignacionFijaUsuarioId: string | null;
  asignacionRotacionIds: string[];
  pais: string;
  moneda: string;
  simboloMoneda: string;
  alicuotaIva: number;
  nombreIva: string;
  mostrarIvaVentas: boolean;
  condicionFiscal: string;
  valorHora: number | null;
  categoriaMonotributo: string | null;
}

export type ResultadoActualizarConfiguracion =
  | { ok: true; configuracion: ConfiguracionRecord }
  | { ok: false; motivo: 'ubicacion_invalida' | 'usuario_invalido' };

export const CONFIGURACION_REPOSITORY = Symbol('CONFIGURACION_REPOSITORY');

/**
 * configuracion_empresa (una fila por empresa, se crea con defaults si no
 * existe). Umbral de stock y remitente viven en el JSON `inventario` (como en
 * el legacy): se actualizan esas claves sin pisar las demás.
 */
export interface ConfiguracionRepository {
  obtener(empresaId: string): Promise<ConfiguracionRecord>;
  actualizar(empresaId: string, input: ActualizarConfiguracionInput): Promise<ResultadoActualizarConfiguracion>;
}
