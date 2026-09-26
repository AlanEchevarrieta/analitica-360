/** Señales automáticas sobre un cliente (se calculan en AdminSaasService). */
export type AlertaEmpresa = 'sin_actividad' | 'ventas_bajan' | 'vence_pronto' | 'prueba_termina' | 'vencida' | 'sin_suscripcion';

/** Un cliente (empresa) visto desde la consola: plan, uso y salud. */
export interface AdminEmpresaFila {
  id: string;
  nombre: string;
  esDemo: boolean;
  /** YYYY-MM-DD (día AR). */
  alta: string;
  baja: string | null;
  suscripcionId: string | null;
  plan: string | null;
  precioPlan: number;
  estado: string | null;
  vencimiento: string | null;
  usuarios: number;
  productos: number;
  ventas30: number;
  monto30: number;
  montoPrevio30: number;
  ultimaVenta: string | null;
  ticketsAbiertos: number;
  pagadoTotal: number;
  ultimoPago: string | null;
  /** Solo en la respuesta del servicio. */
  diasSinVender?: number | null;
  alertas?: AlertaEmpresa[];
}

export interface AdminEvolucionMes {
  /** YYYY-MM */
  mes: string;
  altas: number;
  bajas: number;
  /** Clientes vivos al cierre del mes. */
  clientes: number;
  /** Clientes con al menos una venta en el mes (usan la app de verdad). */
  clientesActivos: number;
  cobrado: number;
  /** Ventas que procesaron todos los clientes con la app. */
  ventas: number;
  montoVendido: number;
}

export interface AdminEmpresaDetalle {
  empresa: AdminEmpresaFila;
  ventasPorMes: { mes: string; ventas: number; monto: number }[];
  usuarios: { nombre: string | null; email: string; rol: string; alta: string }[];
  pagos: { id: string; montoArs: number; metodo: string; estado: string; periodo: string | null; notas: string | null; fecha: string }[];
  tickets: { id: string; numeroTicket: string | null; asunto: string; estado: string; prioridad: string; fecha: string }[];
  historialPlanes: { fecha: string; planAnterior: string | null; planNuevo: string; motivo: string | null }[];
  uso: { clientes: number; compras: number; pedidos: number; ventasTotales: number; primeraVenta: string | null };
}

export interface AdminTablaTamano {
  tabla: string;
  bytes: number;
  filas: number;
}
