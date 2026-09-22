import { z } from 'zod';

const itemCompraSchema = z.object({
  productoId: z.uuid(),
  productoNombre: z.string().trim().min(1),
  varianteId: z.uuid().nullable().optional(),
  loteId: z.uuid().nullable().optional(),
  cantidad: z.number().int().positive(),
  costoUnitario: z.number().nonnegative(),
});

const costosAdicionalesSchema = z.object({
  flete: z.number().nonnegative().default(0),
  impuestos: z.number().nonnegative().default(0),
  otros: z.number().nonnegative().default(0),
  descripcion: z.string().trim().nullable().optional(),
});

export const confirmarCompraSchema = z.object({
  proveedorId: z.uuid().nullable().optional(),
  proveedorNombre: z.string().trim().nullable().optional(),
  fecha: z.string().trim().min(1, 'La fecha es obligatoria'),
  notas: z.string().trim().nullable().optional(),
  ubicacionDestino: z.string().trim().nullable().optional(),
  items: z.array(itemCompraSchema).min(1, 'Agregá al menos un producto'),
  costosAdicionales: costosAdicionalesSchema.optional(),
});
export type ConfirmarCompraInput = z.infer<typeof confirmarCompraSchema>;

export const anularCompraSchema = z.object({
  motivo: z.string().trim().min(1, 'El motivo de anulación es obligatorio'),
});
export type AnularCompraInput = z.infer<typeof anularCompraSchema>;

export const listarComprasQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  proveedor: z.string().trim().default(''),
  mostrarAnuladas: z.coerce.boolean().default(false),
});
export type ListarComprasQuery = z.infer<typeof listarComprasQuerySchema>;
