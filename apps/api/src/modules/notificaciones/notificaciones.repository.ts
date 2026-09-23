export interface ConteoNotificaciones {
  tickets: number;
  pedidos: number;
  lotesVencidos: number;
  lotesPorVencer: number;
}

export const NOTIFICACIONES_REPOSITORY = Symbol('NOTIFICACIONES_REPOSITORY');

/**
 * Puerto fiel de la función SQL real contar_notificaciones() (última
 * definición en supabase/064_notificaciones.sql, sin redefiniciones
 * posteriores). El SQL original envuelve cada conteo en un
 * `EXCEPTION WHEN undefined_table` porque en Supabase las tablas se van
 * creando en migraciones incrementales; acá no hace falta: Ticket, Pedido y
 * Lote ya existen en el schema siempre.
 *
 * Devuelve los 4 conteos SIN filtrar por acceso a módulo del usuario que
 * pide - igual que la RPC real, que tampoco filtra (arma un objeto plano
 * para cualquier usuario autenticado de la empresa). Qué notificaciones
 * mostrarle a cada uno según su rol/módulos (armarItemsNotif() en el
 * legacy) es una decisión de relevancia de UI, no de autorización -
 * ningún dato sensible se expone en un conteo, así que queda en el
 * frontend igual que el resto de la lógica de presentación de Analytics.
 */
export interface NotificacionesRepository {
  contar(empresaId: string): Promise<ConteoNotificaciones>;
}
