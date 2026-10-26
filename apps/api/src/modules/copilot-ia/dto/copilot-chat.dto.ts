import { z } from 'zod';

export const copilotChatSchema = z.object({
  mensaje: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(2000, 'El mensaje supera los 2000 caracteres'),
  topico: z.enum(['ventas', 'productos', 'stock', 'cobranzas', 'inflacion', 'general']).optional().default('general'),
  historial: z
    .array(
      z.object({
        rol: z.enum(['user', 'assistant']),
        contenido: z.string().max(4000),
      }),
    )
    .max(15, 'Historial limitado a 15 interacciones')
    .optional()
    .default([]),
});

export type CopilotChatDto = z.infer<typeof copilotChatSchema>;

export interface CopilotRespuesta {
  respuesta: string;
  metricasUtilizadas?: {
    totalVentasPeriodo?: number;
    ticketPromedio?: number;
    productosLideres?: { nombre: string; cantidad: number; total: number }[];
    stockCriticoCount?: number;
    deudaClientesTotal?: number;
    dolarReferencia?: { tipo: string; valor: number };
    topicoAnalizado?: string;
    detalleTopico?: Record<string, unknown>;
  };
  sugerenciasSiguientes: string[];
}

