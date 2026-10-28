import { Analitica360Error } from './errors.js';
import type {
  AgendaOpcionesResponse,
  Analitica360ClientOptions,
  CondicionesTienda,
  CotizarEnvioInput,
  CrearPedidoInput,
  OpcionEnvioCotizado,
  PedidoCreadoResult,
  ProductoCatalogo,
  ReservaOnlineInput,
  TurnoDetalle,
  TurnoReservadoResult,
  TurnosLibresQuery,
  TurnosLibresResponse,
  ValidarCuponResult,
} from './types.js';

function obtenerBaseUrlPorDefecto(): string {
  if (typeof window !== 'undefined') {
    const globalVar = (window as unknown as { __ANALITICA_API_URL__?: string }).__ANALITICA_API_URL__;
    if (globalVar) return globalVar.replace(/\/+$/, '');
    return 'https://api.analitica360.app';
  }
  const maybeProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  if (maybeProcess?.env?.ANALITICA_API_URL) {
    return maybeProcess.env.ANALITICA_API_URL.replace(/\/+$/, '');
  }
  return 'http://localhost:3001';
}

export class Analitica360Client {
  readonly empresaId: string;
  readonly baseUrl: string;
  private readonly tiendaKey?: string;
  private readonly clientIp?: string;
  private readonly customFetch: typeof fetch;

  constructor(options: Analitica360ClientOptions) {
    if (!options.empresaId) {
      throw new Error('Analitica360Client: se requiere "empresaId" para inicializar el cliente.');
    }
    this.empresaId = options.empresaId;
    this.baseUrl = (options.baseUrl || obtenerBaseUrlPorDefecto()).replace(/\/+$/, '');
    this.tiendaKey = options.tiendaKey;
    this.clientIp = options.clientIp;
    this.customFetch = options.fetch || fetch.bind(globalThis);
  }

  /**
   * Realiza un request HTTP a la API pública de la tienda
   */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/tienda/${this.empresaId}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(init.headers || {});

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.tiendaKey) {
      headers.set('x-tienda-key', this.tiendaKey);
      if (this.clientIp) {
        headers.set('x-forwarded-for', this.clientIp);
      }
    }

    let response: Response;
    try {
      response = await this.customFetch(url, {
        ...init,
        headers,
      });
    } catch (networkError) {
      throw new Analitica360Error(
        `Error de conexión al conectar con Analítica 360 (${(networkError as Error).message})`,
        0,
        'NETWORK_ERROR',
        undefined,
        networkError,
      );
    }

    let body: unknown = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        // respuesta vacía o malformada
      }
    } else {
      try {
        body = await response.text();
      } catch {
        // sin cuerpo
      }
    }

    if (!response.ok) {
      throw Analitica360Error.fromResponse(response.status, body);
    }

    return body as T;
  }

  // ==========================================
  // MÓDULO DE AGENDA Y TURNOS ONLINE
  // ==========================================
  readonly turnos = {
    /**
     * Consulta las opciones de turnos disponibles en el negocio (servicios ofrecidos, profesionales y límites)
     */
    opciones: (): Promise<AgendaOpcionesResponse> => {
      return this.request<AgendaOpcionesResponse>('/turnos');
    },

    /**
     * Consulta los horarios libres en una fecha determinada para un servicio específico (y opcionalmente un profesional)
     */
    libres: (query: TurnosLibresQuery): Promise<TurnosLibresResponse> => {
      const params = new URLSearchParams({
        fecha: query.fecha,
        servicioId: query.servicioId,
      });
      if (query.recursoId) {
        params.set('recursoId', query.recursoId);
      }
      return this.request<TurnosLibresResponse>(`/turnos/libres?${params.toString()}`);
    },

    /**
     * Reserva un turno en la agenda del negocio
     */
    reservar: (input: ReservaOnlineInput, sesionCliente?: string): Promise<TurnoReservadoResult> => {
      const headers: Record<string, string> = {};
      if (sesionCliente) {
        headers['x-sesion-tienda'] = sesionCliente;
      }
      return this.request<TurnoReservadoResult>('/turnos', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
    },

    /**
     * Consulta el estado de un turno a partir del token firmado enviado al reservar
     */
    verCancelacion: (token: string): Promise<TurnoDetalle> => {
      return this.request<TurnoDetalle>(`/turnos/cancelar/${encodeURIComponent(token)}`);
    },

    /**
     * Cancela un turno utilizando el token de cancelación
     */
    cancelar: (token: string): Promise<TurnoDetalle> => {
      return this.request<TurnoDetalle>(`/turnos/cancelar/${encodeURIComponent(token)}`, {
        method: 'POST',
      });
    },
  };

  // ==========================================
  // MÓDULO DE CATÁLOGO Y CONDICIONES
  // ==========================================
  readonly catalogo = {
    /**
     * Obtiene el catálogo completo de productos vendibles con precios, ofertas y variantes vigentes
     */
    listar: (): Promise<ProductoCatalogo[]> => {
      return this.request<ProductoCatalogo[]>('/catalogo');
    },

    /**
     * Obtiene las condiciones comerciales de la tienda (pedido mínimo, descuento por transferencia, etc.)
     */
    condiciones: (): Promise<CondicionesTienda> => {
      return this.request<CondicionesTienda>('/condiciones');
    },
  };

  // ==========================================
  // CUPONES, ENVÍOS Y PEDIDOS
  // ==========================================
  readonly cupones = {
    /**
     * Valida un cupón de descuento contra el subtotal de la compra
     */
    validar: (codigo: string, subtotal: number): Promise<ValidarCuponResult> => {
      return this.request<ValidarCuponResult>('/cupones/validar', {
        method: 'POST',
        body: JSON.stringify({ codigo, subtotal }),
      });
    },
  };

  readonly envios = {
    /**
     * Cotiza las opciones de envío a una ubicación geográfica según los ítems del carrito
     */
    cotizar: (input: CotizarEnvioInput): Promise<OpcionEnvioCotizado[]> => {
      return this.request<OpcionEnvioCotizado[]>('/envios/cotizar', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  };

  readonly pedidos = {
    /**
     * Crea un pedido nuevo en el CRM con origen tienda_online
     */
    crear: (input: CrearPedidoInput, sesionCliente?: string): Promise<PedidoCreadoResult> => {
      const headers: Record<string, string> = {};
      if (sesionCliente) {
        headers['x-sesion-tienda'] = sesionCliente;
      }
      return this.request<PedidoCreadoResult>('/pedidos', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
    },

    /**
     * Genera o reintenta el link de pago (Mercado Pago u otra pasarela configurada)
     */
    pagar: (pedidoId: string): Promise<{ url: string | null }> => {
      return this.request<{ url: string | null }>(`/pedidos/${pedidoId}/pago`, {
        method: 'POST',
      });
    },
  };
}
