export interface CopilotMensaje {
  rol: 'user' | 'assistant';
  contenido: string;
  fecha: string;
}

export interface MetricasNegocio {
  totalVentasPeriodo?: number;
  ticketPromedio?: number;
  productosLideres?: { nombre: string; cantidad: number; total: number }[];
  stockCriticoCount?: number;
  deudaClientesTotal?: number;
  dolarReferencia?: { tipo: string; valor: number };
}

export interface CopilotChatResponse {
  respuesta: string;
  metricasUtilizadas?: MetricasNegocio;
  sugerenciasSiguientes: string[];
}
