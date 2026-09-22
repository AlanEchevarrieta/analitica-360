import { z } from 'zod';
import { TIPOS_INTERACCION } from './clientes.repository.js';

export const guardarClienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  telefono: z.string().trim().nullable().optional(),
  email: z.email().nullable().optional(),
  cumpleanos: z.string().trim().nullable().optional(),
  notasLibres: z.string().trim().nullable().optional(),
  etiquetas: z.array(z.string().trim().min(1)).default([]),
});
export type GuardarClienteInput = z.infer<typeof guardarClienteSchema>;

export const agregarInteraccionSchema = z.object({
  tipo: z.enum(TIPOS_INTERACCION),
  contenido: z.string().trim().min(1, 'El contenido es obligatorio'),
  privado: z.boolean().default(false),
});
export type AgregarInteraccionInput = z.infer<typeof agregarInteraccionSchema>;

export const cumpleanosProximosQuerySchema = z.object({
  horizonteDias: z.coerce.number().int().positive().default(7),
});
export type CumpleanosProximosQuery = z.infer<typeof cumpleanosProximosQuerySchema>;

export const guardarDifusionSchema = z.object({
  segmento: z.string().trim().min(1),
  mensaje: z.string().trim().min(1, 'El mensaje es obligatorio').max(1000),
  cantidad: z.number().int().nonnegative(),
});
export type GuardarDifusionInput = z.infer<typeof guardarDifusionSchema>;
