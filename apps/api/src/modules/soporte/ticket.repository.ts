export type CategoriaTicket = 'consulta' | 'bug' | 'sugerencia' | 'facturacion' | 'otro';
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'urgente';
export type EstadoTicket = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';

export const CATEGORIAS_TICKET: CategoriaTicket[] = ['consulta', 'bug', 'sugerencia', 'facturacion', 'otro'];
export const PRIORIDADES_TICKET: PrioridadTicket[] = ['baja', 'media', 'alta', 'urgente'];
export const ESTADOS_TICKET: EstadoTicket[] = ['abierto', 'en_proceso', 'resuelto', 'cerrado'];

export interface TicketFila {
  id: string;
  numeroTicket: string | null;
  asunto: string;
  categoria: CategoriaTicket;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  createdAt: string;
}

export interface TicketRespuesta {
  id: string;
  ticketId: string;
  autorId: string | null;
  esAdmin: boolean;
  contenido: string;
  createdAt: string;
}

export interface TicketFicha extends TicketFila {
  empresaId: string;
  usuarioId: string | null;
  descripcion: string;
  vistoClienteAt: string | null;
  updatedAt: string;
  empresaNombre: string;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  respuestas: TicketRespuesta[];
}

export interface CrearTicketInput {
  empresaId: string;
  usuarioId: string;
  asunto: string;
  descripcion: string;
  categoria: CategoriaTicket;
  prioridad: PrioridadTicket;
}

export type ResultadoTicket<T> = { ok: true; valor: T } | { ok: false; motivo: 'no_encontrado' | 'ticket_cerrado' };

export interface BannerTicketHome {
  tipo: 'respuesta' | 'revision';
  id: string;
  numero: string | null;
}

export interface TicketFilaAdmin extends TicketFila {
  empresaId: string;
  empresaNombre: string;
}

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/**
 * Puerto fiel de src/lib/tickets.ts, según el SQL real en
 * supabase/039_tickets_soporte.sql. La parte tenant (RLS:
 * `empresa_id = get_empresa_id()`, sin distinción de rol) convive acá con
 * la parte admin (gateada por @RequireAdminApp() en el controller, no acá -
 * el repositorio confía en que el caller ya autorizó):
 * - listarAdmin/fichaAdmin: cross-empresa, puerto de
 *   admin_listar_tickets()/ficha_ticket() (con el bypass de empresa).
 * - cambiarEstado: puerto de cambiarEstadoTicket() - el trigger real
 *   tickets_before_write() solo deja pasar un cambio de estado cuando quien
 *   escribe es admin (para cualquier otro caller revierte silenciosamente a
 *   OLD.*), así que este método asume que ya se verificó @RequireAdminApp().
 * - respuestas con es_admin=true: no expuesto todavía - ni siquiera el
 *   panel admin del legacy tenía una ficha de UI propia acá, se deja para
 *   cuando AdminSoportePanel.tsx tenga su puerto dedicado.
 */
export interface TicketRepository {
  listar(empresaId: string): Promise<TicketFila[]>;
  ficha(empresaId: string, id: string): Promise<TicketFicha | null>;
  crear(input: CrearTicketInput): Promise<TicketFila>;
  responder(empresaId: string, usuarioId: string, ticketId: string, contenido: string): Promise<ResultadoTicket<TicketRespuesta>>;
  marcarVisto(empresaId: string, ticketId: string): Promise<ResultadoTicket<true>>;
  contarNoLeidos(empresaId: string): Promise<number>;
  marcarTodosVistos(empresaId: string): Promise<void>;
  bannerHome(empresaId: string): Promise<BannerTicketHome | null>;
  /** Cross-empresa - puerto de admin_listar_tickets(). Fiel al SQL real: no filtra deleted_at (ni el original lo hacía). */
  listarAdmin(): Promise<TicketFilaAdmin[]>;
  /** Cross-empresa - puerto del bypass de empresa en ficha_ticket() cuando es_admin_app(). */
  fichaAdmin(id: string): Promise<TicketFicha | null>;
  cambiarEstado(id: string, estado: EstadoTicket): Promise<ResultadoTicket<true>>;
}
