import { z } from 'zod';
import { TIPOS_MOVIMIENTO_FINANCIERO, type TipoMovimientoFinanciero } from './estados-contables.util.js';

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

export const periodoEstadosSchema = z
  .object({ desde: fechaIso, hasta: fechaIso })
  .refine((q) => q.hasta >= q.desde, { message: 'PERIODO_INVALIDO', path: ['hasta'] });
export type PeriodoEstados = z.infer<typeof periodoEstadosSchema>;

export const crearMovimientoFinancieroSchema = z
  .object({
    tipo: z.enum(TIPOS_MOVIMIENTO_FINANCIERO as [TipoMovimientoFinanciero, ...TipoMovimientoFinanciero[]]),
    // Un arqueo puede dar 0 (no había plata); el resto tiene que mover algo.
    monto: z.number().nonnegative(),
    fecha: fechaIso,
    descripcion: z.string().trim().default(''),
    proveedorId: z.uuid().nullable().default(null),
    vidaUtilMeses: z.number().int().positive().max(600).nullable().default(null),
    conCaja: z.boolean().default(true),
  })
  .refine((v) => v.tipo === 'arqueo' || v.monto > 0, { message: 'El monto tiene que ser mayor a 0', path: ['monto'] })
  .transform((v) => ({
    ...v,
    descripcion: v.descripcion || DESCRIPCION_DEFAULT[v.tipo],
    proveedorId: v.tipo === 'pago_proveedor' ? v.proveedorId : null,
    vidaUtilMeses: v.tipo === 'bien_uso' ? v.vidaUtilMeses : null,
    conCaja: v.tipo === 'bien_uso' ? v.conCaja : true,
  }));
export type CrearMovimientoFinancieroDto = z.infer<typeof crearMovimientoFinancieroSchema>;

const DESCRIPCION_DEFAULT: Record<TipoMovimientoFinanciero, string> = {
  arqueo: 'Arqueo de caja',
  aporte: 'Aporte de los dueños',
  retiro: 'Retiro de los dueños',
  prestamo_recibido: 'Préstamo recibido',
  prestamo_pago: 'Pago de préstamo',
  bien_uso: 'Bien de uso',
  pago_proveedor: 'Pago a proveedor',
};
