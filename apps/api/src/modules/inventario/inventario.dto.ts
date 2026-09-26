import { z } from 'zod';
import { TIPOS_AJUSTE } from './inventario.util.js';
import { fechaSoloSchema } from '../../common/fecha-solo.js';

export const registrarAjusteSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  tipo: z.enum(TIPOS_AJUSTE),
  cantidad: z.number().positive('La cantidad tiene que ser un número positivo'),
  motivo: z.string().trim().nullable().optional(),
  /** Dónde estaba/está la mercadería (si la empresa usa varias ubicaciones). */
  ubicacion: z.string().trim().min(1).nullable().optional(),
});
export type RegistrarAjusteInput = z.infer<typeof registrarAjusteSchema>;

export const registrarTrasladoSchema = z.object({
  productoId: z.uuid(),
  cantidad: z.number().positive('La cantidad tiene que ser un número positivo'),
  origen: z.string().trim().min(1),
  destino: z.string().trim().min(1),
  fecha: z.iso.datetime({ offset: true }).optional(),
  notas: z.string().trim().nullable().optional(),
});
export type RegistrarTrasladoInput = z.infer<typeof registrarTrasladoSchema>;

export const lineaTrasladoSchema = z.object({
  productoId: z.uuid(),
  nombre: z.string(),
  unidades: z.number(),
});

export const registrarTrasladoMasivoSchema = z.object({
  lineas: z.array(lineaTrasladoSchema).min(1),
  origen: z.string().trim().min(1),
  destino: z.string().trim().min(1),
  fecha: z.iso.datetime({ offset: true }).optional(),
  notas: z.string().trim().nullable().optional(),
});
export type RegistrarTrasladoMasivoInput = z.infer<typeof registrarTrasladoMasivoSchema>;

export const kardexQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type KardexQuery = z.infer<typeof kardexQuerySchema>;

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

export const kardexValorizadoQuerySchema = z
  .object({ desde: fechaIso, hasta: fechaIso, varianteId: z.uuid().optional() })
  .refine((q) => q.desde <= q.hasta, { message: 'El período empieza después de terminar', path: ['desde'] });
export type KardexValorizadoQuery = z.infer<typeof kardexValorizadoQuerySchema>;

export const periodoQuerySchema = z
  .object({ desde: fechaIso, hasta: fechaIso })
  .refine((q) => q.desde <= q.hasta, { message: 'El período empieza después de terminar', path: ['desde'] });
export type PeriodoQuery = z.infer<typeof periodoQuerySchema>;

export const crearLoteSchema = z.object({
  varianteId: z.uuid().nullable().optional(),
  numeroLote: z.string().trim().min(1, 'El número de lote es obligatorio'),
  fechaVencimiento: fechaSoloSchema.nullable().optional(),
  fechaElaboracion: fechaSoloSchema.nullable().optional(),
  cantidadInicial: z.number().nonnegative().default(0),
  proveedorId: z.uuid().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  registrarMovimiento: z.boolean().default(true),
});
export type CrearLoteInput = z.infer<typeof crearLoteSchema>;

export const disponiblesQuerySchema = z.object({
  varianteId: z.uuid().optional(),
});
export type DisponiblesQuery = z.infer<typeof disponiblesQuerySchema>;
