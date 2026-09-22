export interface ProveedorRecord {
  id: string;
  empresaId: string;
  nombre: string;
  razonSocial: string | null;
  nombreComercial: string | null;
  cuit: string | null;
  condicionAfip: string | null;
  nombreVendedor: string | null;
  telefono: string | null;
  email: string | null;
  productosQueProvee: string | null;
  condicionesPago: string | null;
  formasPagoAceptadas: string[];
  plazoEntrega: string | null;
  cbu: string | null;
  aliasCbu: string | null;
  banco: string | null;
  notas: string | null;
  activo: boolean;
}

export interface GuardarProveedorInput {
  nombre: string;
  razonSocial: string | null;
  nombreComercial: string | null;
  cuit: string | null;
  condicionAfip: string | null;
  nombreVendedor: string | null;
  telefono: string | null;
  email: string | null;
  productosQueProvee: string | null;
  condicionesPago: string | null;
  formasPagoAceptadas: string[];
  plazoEntrega: string | null;
  cbu: string | null;
  aliasCbu: string | null;
  banco: string | null;
  notas: string | null;
  activo: boolean;
}

export interface CompraProveedorResumen {
  id: string;
  fecha: string;
  productos: string;
  total: number;
  notas: string | null;
}

export interface ListaProveedores {
  items: ProveedorRecord[];
  total: number;
}

export const PROVEEDORES_REPOSITORY = Symbol('PROVEEDORES_REPOSITORY');

/** Puerto de persistencia de Proveedor. Implementación real: PrismaProveedoresRepository. */
export interface ProveedoresRepository {
  listar(empresaId: string, filtro: { pagina: number; pageSize: number; busqueda: string }): Promise<ListaProveedores>;
  crear(empresaId: string, input: GuardarProveedorInput): Promise<ProveedorRecord>;
  actualizar(empresaId: string, id: string, input: GuardarProveedorInput): Promise<ProveedorRecord | null>;
  buscarPorId(empresaId: string, id: string): Promise<ProveedorRecord | null>;
  /** Ficha del proveedor + historial de compras (no incluye anuladas). */
  historialCompras(empresaId: string, id: string): Promise<CompraProveedorResumen[]>;
}
