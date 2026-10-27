import type { ProveedorPasarela } from '../pasarelas.types.js';

export interface ConfigurarPasarelaDto {
  proveedor: ProveedorPasarela;
  credenciales: Record<string, string>;
  publicKey?: string;
  webhookSecret?: string;
  usoTienda?: boolean;
  usoPos?: boolean;
  usoCuentas?: boolean;
  usoTurnos?: boolean;
}

export interface CrearCobroRapidoDto {
  monto: number;
  moneda?: string;
  concepto: string;
  proveedor: ProveedorPasarela;
  clienteNombre?: string;
  clienteEmail?: string;
  origenTipo?:
    | 'pedido_tienda'
    | 'venta_pos'
    | 'cobro_cuenta_corriente'
    | 'reserva_turno'
    | 'abono'
    | 'link_rapido';
  origenId?: string;
  urlVuelta?: string;
}
