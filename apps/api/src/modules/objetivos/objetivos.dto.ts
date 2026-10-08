import { z } from 'zod';
import { CON_PRODUCTO, PERIODOS_OBJETIVO, SIN_SUCURSAL, TIPOS_OBJETIVO } from './objetivos.util.js';

const texto = z.string().trim().min(1).max(120);

export const guardarObjetivoSchema = z
  .object({
    tipo: z.enum(TIPOS_OBJETIVO),
    periodo: z.enum(PERIODOS_OBJETIVO),
    meta: z.number().positive().max(1e13),
    moneda: z.enum(['ARS', 'USD']).default('ARS'),
    ubicacion: texto.nullable().default(null),
    usuarioId: z.uuid().nullable().default(null),
    productoId: z.uuid().nullable().default(null),
  })
  .refine((o) => !(o.ubicacion && o.usuarioId), { message: 'Elegí una sucursal o un usuario, no los dos', path: ['usuarioId'] })
  .refine((o) => o.tipo !== 'a_tiempo' || o.meta <= 100, { message: 'El porcentaje no puede pasar de 100', path: ['meta'] })
  .refine((o) => CON_PRODUCTO.includes(o.tipo) || !o.productoId, { message: 'El producto solo aplica a producción y unidades vendidas', path: ['productoId'] })
  .refine((o) => !SIN_SUCURSAL.includes(o.tipo) || !o.ubicacion, { message: 'La cobranza no se mide por sucursal', path: ['ubicacion'] });
export type GuardarObjetivoInput = z.infer<typeof guardarObjetivoSchema>;

export const metaPeriodoSchema = z.object({ desde: z.iso.date(), meta: z.number().positive().max(1e13).nullable() });
export type MetaPeriodoInput = z.infer<typeof metaPeriodoSchema>;
