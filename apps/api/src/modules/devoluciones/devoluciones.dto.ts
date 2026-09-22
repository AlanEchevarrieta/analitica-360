import { z } from 'zod';

const itemDevolucionSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  tipo: z.enum(['devuelto', 'entregado']),
});

export const registrarDevolucionSchema = z.object({
  tipo: z.enum(['devolucion', 'cambio']),
  ventaId: z.uuid().nullable().optional(),
  motivo: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  items: z.array(itemDevolucionSchema).min(1, 'Agregá al menos un producto'),
});
export type RegistrarDevolucionInput = z.infer<typeof registrarDevolucionSchema>;

export const listarDevolucionesQuerySchema = z.object({
  tipo: z.string().trim().default(''),
  estado: z.string().trim().default(''),
  desde: z.string().trim().default(''),
  hasta: z.string().trim().default(''),
});
export type ListarDevolucionesQuery = z.infer<typeof listarDevolucionesQuerySchema>;

export const buscarVentasQuerySchema = z.object({
  q: z.string().trim().default(''),
});
export type BuscarVentasQuery = z.infer<typeof buscarVentasQuerySchema>;
