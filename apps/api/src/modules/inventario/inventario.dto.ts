import { z } from 'zod';
import { TIPOS_AJUSTE } from './inventario.util.js';

export const registrarAjusteSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  tipo: z.enum(TIPOS_AJUSTE),
  cantidad: z.number().positive('La cantidad tiene que ser un número positivo'),
  motivo: z.string().trim().nullable().optional(),
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

export const crearLoteSchema = z.object({
  varianteId: z.uuid().nullable().optional(),
  numeroLote: z.string().trim().min(1, 'El número de lote es obligatorio'),
  fechaVencimiento: z.string().trim().nullable().optional(),
  fechaElaboracion: z.string().trim().nullable().optional(),
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
