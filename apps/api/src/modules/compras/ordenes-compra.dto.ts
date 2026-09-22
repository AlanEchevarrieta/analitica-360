import { z } from 'zod';
import { ESTADOS_OC } from './ordenes-compra.repository.js';

const itemOcSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  cantidadPedida: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
});

export const guardarOrdenCompraSchema = z.object({
  proveedorId: z.uuid().nullable().optional(),
  fechaEntregaEstimada: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  estado: z.enum(['borrador', 'enviada']).default('borrador'),
  items: z.array(itemOcSchema).min(1, 'Agregá al menos un producto'),
});
export type GuardarOrdenCompraInput = z.infer<typeof guardarOrdenCompraSchema>;

export const actualizarEstadoOcSchema = z.object({
  estado: z.enum(ESTADOS_OC),
});
export type ActualizarEstadoOcInput = z.infer<typeof actualizarEstadoOcSchema>;

export const registrarRecepcionOcSchema = z.object({
  cantidades: z.record(z.uuid(), z.number().nonnegative()),
});
export type RegistrarRecepcionOcInput = z.infer<typeof registrarRecepcionOcSchema>;

export const listarOrdenesCompraQuerySchema = z.object({
  estado: z.string().trim().default('todos'),
  proveedorId: z.string().trim().default(''),
});
export type ListarOrdenesCompraQuery = z.infer<typeof listarOrdenesCompraQuerySchema>;
