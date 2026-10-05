import { z } from 'zod';

export const estadoProductoSchema = z.enum(['todos', 'activos', 'inactivos']);
export const margenProductoSchema = z.enum(['todos', 'alto', 'medio', 'bajo']);

export const guardarProductoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  categoriaId: z.uuid().nullable().optional(),
  precioVenta: z.number().nonnegative().nullable().optional(),
  costo: z.number().nonnegative().nullable().optional(),
  /** Sin mandar = no cambia (alta: activo). */
  activo: z.boolean().optional(),
  /** Insumo / materia prima (no se vende tal cual). Sin mandar = no cambia (alta: false). */
  esInsumo: z.boolean().optional(),
  unidad: z.enum(['unidad', 'kg', 'g', 'l', 'ml', 'm', 'cm']).optional(),
  /** Se muestra en la tienda online. Sin mandar = no cambia (alta: sí). */
  enTienda: z.boolean().optional(),
});
export type GuardarProductoInput = z.infer<typeof guardarProductoSchema>;

/** null o vacío = que el sistema genere uno. */
export const skuProductoSchema = z.object({ sku: z.string().trim().max(40).nullable() });
export type SkuProductoInput = z.infer<typeof skuProductoSchema>;

export const listarProductosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  busqueda: z.string().trim().default(''),
  categoriaId: z.uuid().optional(),
  estado: estadoProductoSchema.default('todos'),
  margen: margenProductoSchema.default('todos'),
  /** 'demanda': más vendidos primero (unidades de los últimos 90 días). */
  orden: z.enum(['nombre', 'demanda']).default('nombre'),
  /** venta: lo que se vende (sin insumos). insumos: solo materias primas. */
  tipo: z.enum(['todos', 'venta', 'insumos']).default('todos'),
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
