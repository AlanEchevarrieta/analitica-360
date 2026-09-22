import { z } from 'zod';

// TODO Fase 5: cuando exista apps/web, mover estos schemas a
// packages/shared-types para reusarlos en los forms (react-hook-form + zod)
// - hoy ese paquete no tiene consumidores todavía.

export const estadoProductoSchema = z.enum(['todos', 'activos', 'inactivos']);
export const margenProductoSchema = z.enum(['todos', 'alto', 'medio', 'bajo']);

export const guardarProductoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  categoriaId: z.uuid().nullable().optional(),
  precioVenta: z.number().nonnegative().nullable().optional(),
  costo: z.number().nonnegative().nullable().optional(),
  activo: z.boolean().default(true),
});
export type GuardarProductoInput = z.infer<typeof guardarProductoSchema>;

export const listarProductosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  busqueda: z.string().trim().default(''),
  categoriaId: z.uuid().optional(),
  estado: estadoProductoSchema.default('todos'),
  margen: margenProductoSchema.default('todos'),
});
export type ListarProductosQuery = z.infer<typeof listarProductosQuerySchema>;

export const dimensionesProductoSchema = z.object({
  altoCm: z.number().nonnegative().nullable(),
  largoCm: z.number().nonnegative().nullable(),
  anchoCm: z.number().nonnegative().nullable(),
  pesoGr: z.number().nonnegative().nullable(),
});
export type DimensionesProductoInput = z.infer<typeof dimensionesProductoSchema>;

export const codigoBarraProductoSchema = z.object({
  codigoBarra: z.string().trim().min(1).nullable(),
});
export type CodigoBarraProductoInput = z.infer<typeof codigoBarraProductoSchema>;
