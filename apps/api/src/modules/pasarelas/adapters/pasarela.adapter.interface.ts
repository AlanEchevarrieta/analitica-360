import type {
  CobroGeneradoResult,
  CrearCobroInput,
  DetallePagoResult,
  ProveedorPasarela,
  WebhookEventoResult,
} from '../pasarelas.types.js';

export interface PasarelaAdapter {
  readonly proveedor: ProveedorPasarela;

  /** Crea la orden / preferencia / sesión de cobro en la pasarela. */
  crearCobro(
    credenciales: Record<string, string>,
    input: CrearCobroInput,
    webhookUrlBase: string,
  ): Promise<CobroGeneradoResult>;

  procesarWebhook(
    credenciales: Record<string, string>,
    webhookSecret: string | null,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<WebhookEventoResult>;

  /** Consulta el estado actual de un cobro específico en la pasarela. */
  consultarPago(
    credenciales: Record<string, string>,
    idExterno: string,
  ): Promise<DetallePagoResult>;

  /** Reembolsa total o parcialmente un pago previamente aprobado. */
  reembolsar?(
    credenciales: Record<string, string>,
    idExterno: string,
    monto?: number,
  ): Promise<{ reembolsado: boolean; error?: string }>;
}
