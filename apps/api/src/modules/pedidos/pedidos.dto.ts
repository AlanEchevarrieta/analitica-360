import { z } from 'zod';
import { ESTADOS_PEDIDO, ORIGENES_PEDIDO } from './pedidos.repository.js';

const itemPedidoSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  loteId: z.uuid().nullable().optional(),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
});

export const crearPedidoSchema = z.object({
  clienteId: z.uuid().nullable().optional(),
  clienteNombre: z.string().trim().nullable().optional(),
  clienteEmail: z.string().trim().nullable().optional(),
  clienteTelefono: z.string().trim().nullable().optional(),
  direccionEnvio: z.string().trim().nullable().optional(),
  codigoPostal: z.string().trim().nullable().optional(),
  localidad: z.string().trim().nullable().optional(),
  provincia: z.string().trim().nullable().optional(),
  metodoEnvio: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  items: z.array(itemPedidoSchema).min(1, 'Agregá al menos un producto'),
});
export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;

export const asignarPedidoSchema = z.object({
  usuarioId: z.uuid().nullable(),
});
export type AsignarPedidoInput = z.infer<typeof asignarPedidoSchema>;

export const guardarPreparacionItemSchema = z.object({
  cantidadPreparada: z.number().nonnegative(),
  preparado: z.boolean(),
});
export type GuardarPreparacionItemInput = z.infer<typeof guardarPreparacionItemSchema>;

export const registrarDespachoSchema = z.object({
  transportista: z.string().trim().nullable().optional(),
  numeroSeguimiento: z.string().trim().nullable().optional(),
  ubicacionOrigen: z.string().trim().nullable().optional(),
});
export type RegistrarDespachoInput = z.infer<typeof registrarDespachoSchema>;

export const listarPedidosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  estado: z.enum([...ESTADOS_PEDIDO, '']).default(''),
  origen: z.enum([...ORIGENES_PEDIDO, '']).default(''),
  asignadoA: z.uuid().optional(),
});
export type ListarPedidosQuery = z.infer<typeof listarPedidosQuerySchema>;
