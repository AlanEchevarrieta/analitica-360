export interface CompraRecord {
  id: string;
  empresaId: string;
  fecha: string;
  proveedorNombre: string | null;
  proveedorId: string | null;
  ordenCompraId: string | null;
  total: number;
  notas: string | null;
  anulada: boolean;
  costoFlete: number;
  costoImpuestos: number;
  costoOtros: number;
  descripcionOtros: string | null;
  totalCostosAdicionales: number;
  totalReal: number;
  imagenFacturaUrl: string | null;
}

export interface CompraFicha extends CompraRecord {
  items: { productoNombre: string; cantidad: number; costoUnitario: number; subtotal: number }[];
}

export interface ListaCompras {
  items: CompraRecord[];
  total: number;
}

export interface CompraItemInput {
  productoId: string;
  productoNombre: string;
  varianteId?: string | null;
  loteId?: string | null;
  cantidad: number;
  costoUnitario: number;
}

export interface ConfirmarCompraInput {
  usuarioId: string;
  proveedorId?: string | null;
  proveedorNombre: string | null;
  fecha: string;
  notas: string | null;
  ubicacionDestino?: string | null;
  items: CompraItemInput[];
  costosAdicionales?: { flete: number; impuestos: number; otros: number; descripcion: string | null };
}

export type ResultadoConfirmarCompra =
  | { ok: true; compra: CompraRecord }
  | {
      ok: false;
      motivo: 'sin_productos' | 'producto_invalido' | 'variante_invalida' | 'proveedor_invalido' | 'ubicacion_invalida';
    };

export const COMPRAS_REPOSITORY = Symbol('COMPRAS_REPOSITORY');

/**
 * Puerto de persistencia de Compra. Implementación real:
 * PrismaComprasRepository. confirmar() valida productos/variantes/
 * proveedor/ubicación contra la empresa (aislamiento multi-tenant) y crea,
 * en una sola transacción: la Compra, sus CompraItem, y un
 * MovimientoInventario (tipo 'compra', signo +1) por item.
 */
export interface ComprasRepository {
  listar(
    empresaId: string,
    filtro: { pagina: number; pageSize: number; proveedor: string; mostrarAnuladas: boolean },
  ): Promise<ListaCompras>;
  ficha(empresaId: string, id: string): Promise<CompraFicha | null>;
  confirmar(empresaId: string, input: ConfirmarCompraInput): Promise<ResultadoConfirmarCompra>;
  /**
   * Revierte cada MovimientoInventario original de la compra (mismo
   * producto/variante/lote/cantidad, signo -1) y marca la compra como
   * anulada (deletedAt + motivo agregado a notas - Compra no tiene columna
   * propia de motivo de anulación en el schema).
   */
  anular(
    empresaId: string,
    usuarioId: string,
    id: string,
    motivo: string,
  ): Promise<'ok' | 'no_encontrada' | 'ya_anulada'>;
}
