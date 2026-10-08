import { z } from 'zod';
import { CATEGORIAS_GASTO, FRECUENCIAS_GASTO, TIPOS_COSTO, type CategoriaGasto, type FrecuenciaGasto, type TipoCosto } from './gasto.repository.js';

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');
const categoriaSchema = z.enum(CATEGORIAS_GASTO as [CategoriaGasto, ...CategoriaGasto[]]);
const frecuenciaSchema = z.enum(FRECUENCIAS_GASTO as [FrecuenciaGasto, ...FrecuenciaGasto[]]);

export const listarGastosQuerySchema = z
  .object({ desde: fechaIso, hasta: fechaIso, categoria: categoriaSchema.optional() })
  .refine((q) => q.hasta >= q.desde, { message: 'PERIODO_INVALIDO', path: ['hasta'] });
export type ListarGastosQuery = z.infer<typeof listarGastosQuerySchema>;

export const crearGastoSchema = z
  .object({
    categoria: categoriaSchema,
    descripcion: z.string().trim().min(1),
    monto: z.number().positive(),
    fecha: fechaIso,
    recurrente: z.boolean().default(false),
    frecuencia: frecuenciaSchema.nullable().default(null),
    /** Si no viene: recurrente = fijo, el resto = variable. */
    tipoCosto: z.enum(TIPOS_COSTO as [TipoCosto, ...TipoCosto[]]).optional(),
  })
  .transform((v) => ({ ...v, frecuencia: v.recurrente ? v.frecuencia : null, tipoCosto: v.tipoCosto ?? (v.recurrente ? 'fijo' : 'variable') }));
export type CrearGastoDto = z.infer<typeof crearGastoSchema>;

export const tipoCostoSchema = z.object({ tipoCosto: z.enum(TIPOS_COSTO as [TipoCosto, ...TipoCosto[]]) });
export type TipoCostoDto = z.infer<typeof tipoCostoSchema>;
