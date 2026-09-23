export interface ExportVentaCabecera {
  numeroVenta: string | null;
  fecha: string;
  cliente: string | null;
  formaPago: string;
  cuotas: number;
  descuento: number;
  total: number;
  senia: number;
  saldoPendiente: number;
  estadoCobro: string;
  notas: string | null;
}

export interface ExportVentaItem {
  ventaId: string;
  producto: string;
  cantidad: number;
  precioUnitario: number;
}

export interface ExportProducto {
  nombre: string;
  categoria: string | null;
  activo: boolean;
  precioVenta: number | null;
  costo: number | null;
  stock: number;
  codigoBarra: string | null;
}

export interface ExportCompraCabecera {
  fecha: string;
  proveedor: string | null;
  subtotalProductos: number;
  flete: number;
  impuestos: number;
  otros: number;
  totalReal: number;
  notas: string | null;
}

export interface ExportCompraItem {
  fecha: string;
  proveedor: string | null;
  producto: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export interface ExportMovimientoInventario {
  fecha: string;
  producto: string;
  tipo: string;
  cantidad: number;
  signo: number;
  motivo: string | null;
  costoUnitario: number | null;
  origen: string | null;
  destino: string | null;
}

export interface ExportGasto {
  fecha: string;
  categoria: string;
  descripcion: string;
  monto: number;
  recurrente: boolean;
  frecuencia: string | null;
}

export const EXPORTAR_DATOS_REPOSITORY = Symbol('EXPORTAR_DATOS_REPOSITORY');

/**
 * Puerto de lectura para exportación masiva - equivalente a
 * src/lib/exportarDatos.ts (exportarDatosVentas/Productos/Compras/
 * Inventario/Gastos; exportarDatosClientes se resuelve reusando
 * ClientesService, no tiene método propio acá). Los valores se
 * devuelven crudos (fechas ISO, forma_pago/tipo sin traducir a
 * etiqueta) - el formato es-AR y el armado del .xlsx quedan en el
 * frontend, igual criterio que en Analytics/Contabilidad.
 */
export interface ExportarDatosRepository {
  ventas(empresaId: string): Promise<{ cabecera: ExportVentaCabecera[]; items: ExportVentaItem[] }>;
  productos(empresaId: string): Promise<ExportProducto[]>;
  compras(empresaId: string): Promise<{ cabecera: ExportCompraCabecera[]; items: ExportCompraItem[] }>;
  inventario(empresaId: string): Promise<ExportMovimientoInventario[]>;
  gastos(empresaId: string): Promise<ExportGasto[]>;
}
