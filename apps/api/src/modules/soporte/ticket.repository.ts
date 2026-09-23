export type CategoriaTicket = 'consulta' | 'bug' | 'sugerencia' | 'facturacion' | 'otro';
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'urgente';
export type EstadoTicket = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';

export const CATEGORIAS_TICKET: CategoriaTicket[] = ['consulta', 'bug', 'sugerencia', 'facturacion', 'otro'];
export const PRIORIDADES_TICKET: PrioridadTicket[] = ['baja', 'media', 'alta', 'urgente'];

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

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/**
 * Puerto fiel de la parte TENANT (no admin) de src/lib/tickets.ts, según el
 * SQL real en supabase/039_tickets_soporte.sql: cualquier usuario
 * autenticado de la empresa puede ver/crear/responder sus propios tickets
 * (RLS: `empresa_id = get_empresa_id()`, sin distinción de rol).
 *
 * Deliberadamente fuera de alcance - requieren el concepto "es_admin_app()"
 * (staff de Analítica 360 con acceso cross-tenant), que no existe todavía
 * en el sistema de roles nuevo (Rol = dueno|operador|contador, todos
 * tenant-scoped) y le corresponde a AdminSaasModule, fase posterior:
 * - listarTicketsAdmin/admin_listar_tickets(): panel cross-empresa.
 * - cambiarEstadoTicket(): el trigger tickets_before_write() en el SQL real
 *   revierte silenciosamente estado/categoria/prioridad/asunto/descripcion
 *   a su valor anterior si quien actualiza NO es admin - un tenant llamando
 *   a este endpoint hoy no cambiaría nada en los hechos, así que no se
 *   expone en vez de simular un endpoint que no haría lo que promete.
 * - respuestas con es_admin=true: siempre false en este módulo, coherente
 *   con que acá no hay usuarios admin todavía.
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
}
