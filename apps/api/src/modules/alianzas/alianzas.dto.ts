import { z } from 'zod';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
const mes = z.string().regex(/^\d{4}-\d{2}$/, 'Mes inválido (AAAA-MM)');
const porcentaje = z.number().min(0).max(100);
const textoOpcional = z.string().trim().max(200).nullable().optional();

export const tramosSchema = z
  .array(z.object({ desde: z.number().int().min(1), hasta: z.number().int().min(1).nullable(), porcentaje }))
  .min(1, 'Cargá al menos un tramo')
  .refine(
    (tramos) =>
      tramos[0].desde === 1 &&
      tramos.every((t, i) => (t.hasta == null || t.hasta >= t.desde) && (i === 0 || (tramos[i - 1].hasta != null && t.desde === tramos[i - 1].hasta! + 1))) &&
      tramos[tramos.length - 1].hasta == null,
    { message: 'Los tramos tienen que arrancar en 1, seguirse sin huecos y el último no tiene tope' },
  );

export const camaraSchema = z.object({
  nombre: z.string().trim().min(2, 'Poné el nombre de la cámara').max(120),
  contactoNombre: textoOpcional,
  contactoEmail: z.string().trim().email('Email inválido').nullable().optional().or(z.literal('').transform(() => null)),
  contactoTelefono: textoOpcional,
  activa: z.boolean().default(true),
  mesesComision: z.number().int().min(1).max(120).default(24),
  tramos: tramosSchema,
  notas: z.string().trim().max(2000).nullable().optional(),
});
export type CamaraDto = z.infer<typeof camaraSchema>;
export const camaraParcialSchema = camaraSchema.partial();

export const reglaCicloSchema = z.object({
  entrada: z.array(z.object({ meses: z.number().int().min(1).max(12), porcentaje })).default([]),
  periodosEntrada: z.number().int().min(1).max(12).default(1),
  renovacionPct: porcentaje.default(0),
  renovacionPeriodos: z.number().int().min(1).nullable().default(null),
  cuotas: z.number().int().min(1).max(12).default(1),
});

export const reglasSchema = z.object({
  mensual: reglaCicloSchema.optional(),
  trimestral: reglaCicloSchema.optional(),
  anual: reglaCicloSchema.optional(),
});

export const cuponSchema = z.object({
  codigo: z.string().trim().min(3, 'El código tiene que tener al menos 3 caracteres').max(30),
  tipo: z.enum(['camara', 'descuento', 'referido']),
  camaraId: z.string().uuid().nullable().optional(),
  descripcion: z.string().trim().max(300).nullable().optional(),
  diasPrueba: z.number().int().min(1).max(365).nullable().optional(),
  reglas: reglasSchema.default({}),
  desde: fecha.nullable().optional(),
  hasta: fecha.nullable().optional(),
  maxUsos: z.number().int().min(1).nullable().optional(),
  activo: z.boolean().default(true),
});
export type CuponDto = z.infer<typeof cuponSchema>;
export const cuponParcialSchema = cuponSchema.partial();

export const origenSchema = z.object({
  camaraId: z.string().uuid().nullable(),
  cuponId: z.string().uuid().nullable(),
  motivo: z.string().trim().min(5, 'Contá brevemente por qué se cambia'),
});
export type OrigenDto = z.infer<typeof origenSchema>;

const planCiclo = {
  empresaId: z.string().uuid(),
  plan: z.enum(['basico', 'pro', 'ecommerce']),
  ciclo: z.enum(['mensual', 'trimestral', 'anual']),
  desde: fecha.optional(),
  enCuotas: z.boolean().optional(),
  grupoId: z.string().uuid().optional(),
};

export const cotizarCobroSchema = z.object(planCiclo);
export type CotizarCobroDto = z.infer<typeof cotizarCobroSchema>;

export const registrarCobroSchema = z.object({
  ...planCiclo,
  metodo: z.string().trim().min(1, 'Indicá el medio de pago'),
  notas: z.string().trim().max(500).default(''),
  monto: z.number().positive().optional(),
  fechaCobro: fecha.optional(),
});
export type RegistrarCobroDto = z.infer<typeof registrarCobroSchema>;

export const devolverPagoSchema = z.object({ motivo: z.string().trim().min(3, 'Contá el motivo de la devolución') });

export const liquidacionQuerySchema = z.object({ camaraId: z.string().uuid(), mes });
export const aprobarLiquidacionSchema = z.object({ camaraId: z.string().uuid(), mes });
export const pagarLiquidacionSchema = z.object({ fecha, referencia: z.string().trim().min(1, 'Poné la referencia (ej. número de transferencia)') });

export const codigoSchema = z.object({ codigo: z.string().trim().min(1, 'Escribí el código').max(40) });
export const codigoQuerySchema = z.object({ codigo: z.string().trim().max(40).default('') });
