export const TIPOS_INTERACCION = ['nota', 'preferencia', 'dato_personal', 'queja', 'cumplido', 'seguimiento'] as const;
export type TipoInteraccion = (typeof TIPOS_INTERACCION)[number];

export interface ClienteRecord {
  id: string;
  empresaId: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
  notasLibres: string | null;
  etiquetas: string[];
  ultimaCompra: string | null;
  totalGastado: number;
  cantidadCompras: number;
}

export interface InteraccionRecord {
  id: string;
  tipo: TipoInteraccion;
  contenido: string;
  privado: boolean;
  createdAt: Date;
}

export interface VentaResumenCliente {
  id: string;
  fecha: Date;
  productos: string;
  total: number;
  formaPago: string;
}

export interface ClienteFicha extends ClienteRecord {
  ventas: VentaResumenCliente[];
  interacciones: InteraccionRecord[];
}

export interface GuardarClienteInput {
  nombre: string;
  telefono: string | null;
  email: string | null;
  cumpleanos: string | null;
  notasLibres: string | null;
  etiquetas: string[];
}

export interface AgregarInteraccionInput {
  clienteId: string;
  usuarioId: string;
  tipo: TipoInteraccion;
  contenido: string;
  privado: boolean;
}

export type IdSegmento = 'inactivos' | 'enRiesgo' | 'cumpleanos' | 'vip';

export interface ClienteSegmentoRecord {
  id: string;
  nombre: string;
  telefono: string | null;
  dias: number | null;
  ultimaCompra: string | null;
  fechaNacimiento: string | null;
  totalFacturado: number | null;
  totalCompras: number | null;
}

export interface SegmentosClientes {
  inactivos: ClienteSegmentoRecord[];
  enRiesgo: ClienteSegmentoRecord[];
  cumpleanos: ClienteSegmentoRecord[];
  vip: ClienteSegmentoRecord[];
  conteos: Record<IdSegmento, number>;
}

export interface CumpleProximoRecord {
  id: string;
  nombre: string;
  telefono: string | null;
  dias: number;
}

export interface DestinatarioDifusion {
  id: string;
  nombre: string;
  telefono: string | null;
}

export interface DifusionRecord {
  id: string;
  segmento: string;
  mensaje: string;
  cantidad: number;
  fecha: Date;
}

export interface GuardarDifusionInput {
  usuarioId: string;
  segmento: string;
  mensaje: string;
  cantidad: number;
}

export const CLIENTES_REPOSITORY = Symbol('CLIENTES_REPOSITORY');

/**
 * Puerto de persistencia de Cliente + Difusion. Implementación real:
 * PrismaClientesRepository. Los "segmentos" (inactivos/en riesgo/cumpleaños/
 * VIP) no son una tabla propia - se calculan al vuelo agregando Venta por
 * cliente, igual que segmentos_clientes() en el legacy (ver comentario en
 * ClienteInteraccion del schema). VIP = top 10 por total facturado (con al
 * menos 1 compra) - el legacy resolvía esto en una función SQL que no está
 * disponible para portar 1:1; es la interpretación más razonable de "top
 * clientes" dado el resto de la evidencia (rótulos de META_SEGMENTO).
 */
export interface ClientesRepository {
  listar(empresaId: string): Promise<ClienteRecord[]>;
  ficha(empresaId: string, id: string): Promise<ClienteFicha | null>;
  crear(empresaId: string, input: GuardarClienteInput): Promise<ClienteRecord>;
  actualizar(empresaId: string, id: string, input: GuardarClienteInput): Promise<ClienteRecord | null>;
  agregarInteraccion(empresaId: string, input: AgregarInteraccionInput): Promise<'ok' | 'cliente_invalido'>;
  segmentos(empresaId: string): Promise<SegmentosClientes>;
  cumpleanosProximos(empresaId: string, horizonteDias: number): Promise<CumpleProximoRecord[]>;
  cumpleanosMes(empresaId: string): Promise<DestinatarioDifusion[]>;
  listarDifusiones(empresaId: string): Promise<DifusionRecord[]>;
  guardarDifusion(empresaId: string, input: GuardarDifusionInput): Promise<DifusionRecord>;
}
