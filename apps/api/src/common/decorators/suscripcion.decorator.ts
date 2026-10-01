import { SetMetadata } from '@nestjs/common';

export const PERMITIDO_SIN_SUSCRIPCION_KEY = 'permitidoSinSuscripcion';
export const EXPORTACION_KEY = 'exportacion';

/**
 * Funciona aunque la cuenta esté en solo lectura (prueba o plan vencido):
 * lo necesario para contratar un plan o pedir ayuda (ver SuscripcionGuard).
 */
export const PermitidoSinSuscripcion = () => SetMetadata(PERMITIDO_SIN_SUSCRIPCION_KEY, true);

/** Descarga de datos: con la prueba gratis vencida no se permite (ver AccesoCuenta.puedeExportar). */
export const Exportacion = () => SetMetadata(EXPORTACION_KEY, true);
