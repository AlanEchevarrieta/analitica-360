import { z } from 'zod';

// Endpoint público: límites explícitos de tamaño para no aceptar payloads
// arbitrarios de cualquiera en internet.
const texto = (max: number) => z.string().trim().max(max);
const requerido = (max: number, mensaje: string) => texto(max).min(1, mensaje);

const itemPedidoTiendaSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().optional(),
  cantidad: z.number().int().min(1).max(100),
});

export const crearPedidoTiendaSchema = z.object({
  clienteNombre: requerido(120, 'Ingresá tu nombre'),
  clienteEmail: z.email('Ingresá un email válido').max(160),
  clienteTelefono: requerido(40, 'Ingresá tu teléfono'),
  direccionEnvio: requerido(200, 'Ingresá la dirección de envío'),
  codigoPostal: requerido(12, 'Ingresá el código postal'),
  localidad: requerido(80, 'Ingresá la ciudad'),
  provincia: requerido(60, 'Ingresá la provincia'),
  notas: texto(500).nullable().optional(),
  items: z.array(itemPedidoTiendaSchema).min(1, 'El carrito está vacío').max(50),
  cuponCodigo: texto(40).nullable().optional(),
  formaPago: z.enum(['transferencia', 'a_coordinar']).default('a_coordinar'),
});
export type CrearPedidoTiendaInput = z.infer<typeof crearPedidoTiendaSchema>;

export const validarCuponSchema = z.object({
  codigo: requerido(40, 'Ingresá el código'),
  subtotal: z.number().min(0).max(1_000_000_000),
});
export type ValidarCuponInput = z.infer<typeof validarCuponSchema>;
