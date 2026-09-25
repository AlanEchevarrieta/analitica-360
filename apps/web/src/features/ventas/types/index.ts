// Espejo de VentaRecord / ListaVentas (apps/api modules/ventas/ventas.repository.ts).
export interface VentaFila {
  id: string;
  numeroVenta: string | null;
  fecha: string;
  formaPago: string;
  clienteNombre: string | null;
  anulada: boolean;
  esSenia: boolean;
  saldoPendiente: number;
  estadoCobro: string;
  productos: string;
  total: number;
}

export interface ListaVentas {
  items: VentaFila[];
  total: number;
}

export interface FiltrosVentas {
  pagina: number;
  desde: string;
  hasta: string;
  cliente: string;
}
