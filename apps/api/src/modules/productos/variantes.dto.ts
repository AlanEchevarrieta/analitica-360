import { z } from 'zod';

export const varianteInputSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().nullable().optional(),
  atributos: z.record(z.string(), z.string()),
  precioVenta: z.number().nonnegative().nullable().optional(),
  costo: z.number().nonnegative().nullable().optional(),
  activo: z.boolean().default(true),
});
export type VarianteInput = z.infer<typeof varianteInputSchema>;

export const guardarVariantesProductoSchema = z.object({
  variantes: z.array(varianteInputSchema),
  /**
   * Obligatorio cuando el producto tiene stock sin variante (típicamente al
   * agregarle variantes por primera vez): a qué variante va cada unidad.
   * Tiene que sumar exactamente ese stock.
   */
  repartoSinVariante: z
    .array(z.object({ atributos: z.record(z.string(), z.string()), cantidad: z.number().int().positive() }))
    .optional(),
});
export type GuardarVariantesProductoInput = z.infer<typeof guardarVariantesProductoSchema>;
