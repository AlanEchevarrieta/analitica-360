import { z } from 'zod';
import { FORMAS_PAGO } from './ventas.util.js';

const itemVentaSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  loteId: z.uuid().nullable().optional(),
  cantidad: z.number().int().positive(),
  precioUnitario: z.number().nonnegative(),
});

export const confirmarVentaSchema = z.object({
  items: z.array(itemVentaSchema).min(1, 'Agregá al menos un producto'),
  formaPago: z.enum(FORMAS_PAGO),
  descuento: z.number().nonnegative().default(0),
  clienteNombre: z.string().trim().nullable().optional(),
  clienteId: z.uuid().nullable().optional(),
  cuotas: z.number().int().positive().default(1),
  coeficienteInteres: z.number().nonnegative().default(0),
  ubicacionOrigen: z.string().trim().nullable().optional(),
  esSenia: z.boolean().default(false),
  montoSenia: z.number().nonnegative().default(0),
});
export type ConfirmarVentaInput = z.infer<typeof confirmarVentaSchema>;

export const anularVentaSchema = z.object({
  motivo: z.string().trim().min(1, 'El motivo de anulación es obligatorio'),
});
export type AnularVentaInput = z.infer<typeof anularVentaSchema>;

export const cobrarSaldoVentaSchema = z.object({
  monto: z.number().positive(),
  formaPago: z.enum(FORMAS_PAGO),
  fecha: z.string().trim().min(1, 'La fecha es obligatoria'),
});
export type CobrarSaldoVentaInput = z.infer<typeof cobrarSaldoVentaSchema>;

export const listarVentasQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  desde: z.string().trim().default(''),
  hasta: z.string().trim().default(''),
  forma: z.string().trim().default(''),
  cliente: z.string().trim().default(''),
  productoId: z.string().trim().default(''),
  numeroVenta: z.string().trim().default(''),
  mostrarAnuladas: z.coerce.boolean().default(false),
});
export type ListarVentasQuery = z.infer<typeof listarVentasQuerySchema>;
