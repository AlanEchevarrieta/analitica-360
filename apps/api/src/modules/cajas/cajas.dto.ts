import { z } from 'zod';

export const abrirCajaSchema = z.object({
  montoInicial: z.coerce.number().min(0, 'El monto inicial debe ser mayor o igual a cero'),
  nombreCaja: z.string().trim().min(1).max(50).default('Caja Principal'),
  ubicacionId: z.string().uuid().optional(),
  notasApertura: z.string().max(500).optional(),
});

export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;

export const crearMovimientoCajaSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso'], {
    message: 'El tipo debe ser "ingreso" o "egreso" (sangría)',
  }),
  monto: z.coerce.number().positive('El monto debe ser mayor a cero'),
  concepto: z.string().trim().min(3, 'El concepto debe tener al menos 3 caracteres').max(200),
  comprobanteRef: z.string().trim().max(100).optional(),
});

export type CrearMovimientoCajaInput = z.infer<typeof crearMovimientoCajaSchema>;

export const cerrarCajaSchema = z.object({
  montoDeclarado: z.coerce.number().min(0, 'El monto declarado no puede ser negativo'),
  notasCierre: z.string().max(500).optional(),
});

export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;

export const listarCajasQuerySchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
  limite: z.coerce.number().int().min(1).max(100).default(30),
});

export type ListarCajasQuery = z.infer<typeof listarCajasQuerySchema>;
