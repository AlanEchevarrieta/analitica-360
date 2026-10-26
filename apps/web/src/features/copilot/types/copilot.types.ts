export type CopilotTopico = 'ventas' | 'productos' | 'stock' | 'cobranzas' | 'inflacion' | 'general';

export interface CopilotMensaje {
  rol: 'user' | 'assistant';
  contenido: string;
  fecha: string;
  topico?: CopilotTopico;
}

export interface MetricasNegocio {
  totalVentasPeriodo?: number;
  ticketPromedio?: number;
  productosLideres?: { nombre: string; cantidad: number; total: number }[];
  stockCriticoCount?: number;
  deudaClientesTotal?: number;
  dolarReferencia?: { tipo: string; valor: number };
  topicoAnalizado?: string;
  detalleTopico?: Record<string, unknown>;
}

export interface CopilotChatResponse {
  respuesta: string;
  metricasUtilizadas?: MetricasNegocio;
  sugerenciasSiguientes: string[];
}
