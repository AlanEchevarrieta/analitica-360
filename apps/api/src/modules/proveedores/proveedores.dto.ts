import { z } from 'zod';

export const CONDICIONES_AFIP = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final'] as const;
export const CONDICIONES_PAGO = ['Contado', '15 días', '30 días', '60 días', 'Consignación', 'Otro'] as const;
export const FORMAS_PAGO_ACEPTADAS = ['Transferencia', 'Efectivo', 'Cheque', 'Mercado Pago'] as const;

const textoOpcional = z.string().trim().nullable().optional();

export const guardarProveedorSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  razonSocial: textoOpcional,
  nombreComercial: textoOpcional,
  cuit: textoOpcional,
  condicionAfip: textoOpcional,
  nombreVendedor: textoOpcional,
  telefono: textoOpcional,
  email: z.email().nullable().optional(),
  productosQueProvee: textoOpcional,
  condicionesPago: textoOpcional,
  formasPagoAceptadas: z.array(z.string()).default([]),
  plazoEntrega: textoOpcional,
  cbu: textoOpcional,
  aliasCbu: textoOpcional,
  banco: textoOpcional,
  notas: textoOpcional,
  activo: z.boolean().default(true),
});
export type GuardarProveedorInput = z.infer<typeof guardarProveedorSchema>;

export const listarProveedoresQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  busqueda: z.string().trim().default(''),
});
export type ListarProveedoresQuery = z.infer<typeof listarProveedoresQuerySchema>;
