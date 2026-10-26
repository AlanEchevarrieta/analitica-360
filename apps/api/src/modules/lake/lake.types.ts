export type TipoEventoLake =
  | 'venta.registrada'
  | 'compra.registrada'
  | 'turno.atendido'
  | 'orden.entregada'
  | 'precio.modificado'
  | 'stock.ajuste';

export type CategoriaInsight =
  | 'afinidad_canasta'
  | 'churn_cliente'
  | 'rentabilidad_oculta'
  | 'proveedor_retraso'
  | 'estacionalidad_horaria'
  | 'oportunidad_margen'
  | 'desfasaje_competitivo';

export type PrioridadInsight = 'critica' | 'alta' | 'media' | 'informativa';

export interface IngestarEventoInput {
  empresaId: string;
  tipoEvento: TipoEventoLake | string;
  entidadId?: string;
  fecha?: Date;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface InsightOculto {
  categoria: CategoriaInsight;
  prioridad: PrioridadInsight;
  titulo: string;
  descripcionTecnica: string;
  sugerenciaAccionable: string;
  datos: Record<string, unknown>;
  validoHasta?: Date;
}
