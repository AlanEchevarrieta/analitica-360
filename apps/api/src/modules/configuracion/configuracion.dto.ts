import { z } from 'zod';

export const MEDIOS_PAGO_CONFIG = ['efectivo', 'transferencia', 'debito', 'credito', 'mp_qr'] as const;

const tasaCuotaSchema = z.object({
  cuotas: z.number().int().min(0).max(60),
  tasa: z.number().min(0).max(500),
  label: z.string().trim().min(1).max(40),
  activo: z.boolean(),
  personalizada: z.boolean().default(false),
});

const textoOpcional = z.string().trim().max(200).nullable().optional();

/** PATCH parcial: solo se actualiza lo que viene. */
export const actualizarConfiguracionSchema = z
  .object({
    mediosPago: z.array(z.enum(MEDIOS_PAGO_CONFIG)).min(1, 'Dejá al menos un medio de pago').optional(),
    tasasCuotas: z.array(tasaCuotaSchema).max(24).optional(),
    mostrarCliente: z.enum(['siempre', 'opcional', 'no_mostrar']).optional(),
    crearClienteDesdeVenta: z.boolean().optional(),
    umbralStockBajo: z.number().int().min(0).max(100_000).optional(),
    ubicacionVentaDefault: z.string().trim().max(120).nullable().optional(),
    remitente: z
      .object({ nombre: textoOpcional, direccion: textoOpcional, telefono: textoOpcional, email: textoOpcional })
      .optional(),
    modoAsignacion: z.enum(['manual', 'round_robin', 'todo_a_uno']).optional(),
    asignacionFijaUsuarioId: z.uuid().nullable().optional(),
    asignacionRotacionIds: z.array(z.uuid()).optional(),
    pais: z.enum(['argentina', 'peru', 'colombia', 'otro']).optional(),
    moneda: z.string().trim().min(3).max(3).optional(),
    simboloMoneda: z.string().trim().min(1).max(4).optional(),
    alicuotaIva: z.number().min(0).max(100).optional(),
    nombreIva: z.string().trim().min(1).max(20).optional(),
    mostrarIvaVentas: z.boolean().optional(),
    condicionFiscal: z.enum(['monotributo', 'responsable_inscripto', 'exento', 'otro']).optional(),
    /** Dólar para ver los reportes en US$. */
    dolarTipo: z.enum(['blue', 'oficial', 'bolsa']).optional(),
    /** Costo de una hora de trabajo (Producción). null = sin cargar. */
    valorHora: z.number().min(0).max(10_000_000).nullable().optional(),
    categoriaMonotributo: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']).nullable().optional(),
  })
  .refine((c) => !c.tasasCuotas || new Set(c.tasasCuotas.map((t) => t.cuotas)).size === c.tasasCuotas.length, {
    message: 'Hay dos planes con la misma cantidad de cuotas',
    path: ['tasasCuotas'],
  });
export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;
