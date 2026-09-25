// Espejo de CompraRecord / ListaCompras (apps/api modules/compras/compras.repository.ts).
export interface CompraFila {
  id: string;
  fecha: string;
  proveedorNombre: string | null;
  total: number;
  notas: string | null;
  anulada: boolean;
  totalCostosAdicionales: number;
  totalReal: number;
  /** Se paga después: deuda con el proveedor. */
  aCredito: boolean;
}

export interface ListaCompras {
  items: CompraFila[];
  total: number;
}

export interface ProveedorFila {
  id: string;
  nombre: string;
}

export interface ConfirmarCompraInput {
  proveedorId: string | null;
  proveedorNombre: string | null;
  fecha: string;
  notas: string | null;
  ubicacionDestino: string | null;
  items: {
    productoId: string;
    productoNombre: string;
    varianteId: string | null;
    cantidad: number;
    costoUnitario: number;
  }[];
  costosAdicionales: { flete: number; impuestos: number; otros: number; descripcion: string | null };
  aCredito: boolean;
}
