export const ESTADOS_OC = ['borrador', 'enviada', 'confirmada', 'recibida_parcial', 'recibida', 'cancelada'] as const;
export type EstadoOc = (typeof ESTADOS_OC)[number];

export interface OrdenCompraItemRecord {
  id: string;
  productoId: string;
  varianteId: string | null;
  productoNombre: string;
  varianteEtiqueta: string | null;
  cantidadPedida: number;
  precioUnitario: number;
  cantidadRecibida: number;
  recibido: boolean;
}

export interface OrdenCompraRecord {
  id: string;
  empresaId: string;
  numeroOc: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  estado: EstadoOc;
  fechaEmision: string;
  fechaEntregaEstimada: string | null;
  notas: string | null;
  total: number;
}

export interface OrdenCompraFicha extends OrdenCompraRecord {
  items: OrdenCompraItemRecord[];
  proveedorContacto: string | null;
  proveedorCuit: string | null;
}

export interface ItemOcInput {
  productoId: string;
  varianteId: string | null;
  cantidadPedida: number;
  precioUnitario: number;
}

export interface GuardarOrdenCompraInput {
  proveedorId: string | null;
  fechaEntregaEstimada: string | null;
  notas: string | null;
  estado: 'borrador' | 'enviada';
  items: ItemOcInput[];
}

export type MotivoRechazoOc = 'proveedor_invalido' | 'producto_invalido' | 'variante_invalida';

export type ResultadoGuardarOc =
  | { ok: true; orden: OrdenCompraFicha }
  | { ok: false; motivo: MotivoRechazoOc | 'no_encontrada' };

export type ResultadoRecepcionOc =
  | { ok: true; orden: OrdenCompraFicha }
  | { ok: false; motivo: 'no_encontrada' | 'sin_cantidades' };

export const ORDENES_COMPRA_REPOSITORY = Symbol('ORDENES_COMPRA_REPOSITORY');

/**
 * Puerto de persistencia de OrdenCompra. Implementación real:
 * PrismaOrdenesCompraRepository. registrarRecepcion() crea la Compra +
 * CompraItem + MovimientoInventario correspondientes y actualiza los items
 * de la OC, todo en una única transacción - a diferencia del legacy (RPC
 * confirmar_compra separada + updates sueltos + un hack de buscar "la
 * última compra cuyas notas mencionan el número de OC"), acá
 * Compra.ordenCompraId es una FK real seteada directo, sin heurística.
 */
export interface OrdenesCompraRepository {
  listar(empresaId: string, filtro: { estado: string; proveedorId: string }): Promise<OrdenCompraRecord[]>;
  ficha(empresaId: string, id: string): Promise<OrdenCompraFicha | null>;
  crear(empresaId: string, input: GuardarOrdenCompraInput): Promise<ResultadoGuardarOc>;
  actualizar(empresaId: string, id: string, input: GuardarOrdenCompraInput): Promise<ResultadoGuardarOc>;
  actualizarEstado(empresaId: string, id: string, estado: EstadoOc): Promise<OrdenCompraRecord | null>;
  registrarRecepcion(
    empresaId: string,
    usuarioId: string,
    id: string,
    cantidades: Record<string, number>,
  ): Promise<ResultadoRecepcionOc>;
}
