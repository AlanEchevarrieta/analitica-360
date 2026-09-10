import type { SupabaseClient } from '@supabase/supabase-js'

export const CATEGORIAS_TICKET = [
  { id: 'consulta', label: 'Consulta general' },
  { id: 'bug', label: 'Bug o error' },
  { id: 'sugerencia', label: 'Sugerencia' },
  { id: 'facturacion', label: 'Facturación' },
  { id: 'otro', label: 'Otro' },
] as const

export const PRIORIDADES_TICKET = [
  { id: 'baja', label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta', label: 'Alta' },
  { id: 'urgente', label: 'Urgente' },
] as const

export const ESTADOS_TICKET = [
  { id: 'abierto', label: 'Abierto' },
  { id: 'en_proceso', label: 'En proceso' },
  { id: 'resuelto', label: 'Resuelto' },
  { id: 'cerrado', label: 'Cerrado' },
] as const

export type CategoriaTicket = (typeof CATEGORIAS_TICKET)[number]['id']
export type PrioridadTicket = (typeof PRIORIDADES_TICKET)[number]['id']
export type EstadoTicket = (typeof ESTADOS_TICKET)[number]['id']

export type TicketFila = {
  id: string
  numero_ticket: string
  asunto: string
  categoria: CategoriaTicket
  prioridad: PrioridadTicket
  estado: EstadoTicket
  created_at: string
  empresa_id?: string
  empresa_nombre?: string
}

export type TicketRespuesta = {
  id: string
  ticket_id: string
  autor_id: string | null
  es_admin: boolean
  contenido: string
  created_at: string
}

export type TicketFicha = {
  id: string
  empresa_id: string
  usuario_id: string | null
  numero_ticket: string
  asunto: string
  descripcion: string
  categoria: CategoriaTicket
  prioridad: PrioridadTicket
  estado: EstadoTicket
  visto_cliente_at: string | null
  created_at: string
  updated_at: string
  empresa_nombre: string
  usuario_nombre: string | null
  usuario_email: string | null
  respuestas: TicketRespuesta[]
}

export type BannerTicketHome = {
  tipo: 'respuesta' | 'revision'
  id: string
  numero: string
}

const MSG_SQL =
  'Falta crear las tablas de soporte en Supabase. Pegá supabase/039_tickets_soporte.sql (rol postgres) y recargá.'

function esFaltaSql(error: { message?: string } | null) {
  const t = String(error?.message ?? '').toLowerCase()
  return (
    t.includes('schema cache') ||
    t.includes('could not find') ||
    t.includes('does not exist') ||
    (t.includes('relation') && t.includes('tickets'))
  )
}

export function etiquetaCategoria(id: string) {
  return CATEGORIAS_TICKET.find((c) => c.id === id)?.label ?? id
}

export function etiquetaPrioridad(id: string) {
  return PRIORIDADES_TICKET.find((c) => c.id === id)?.label ?? id
}

export function etiquetaEstado(id: string) {
  return ESTADOS_TICKET.find((c) => c.id === id)?.label ?? id
}

export function formatoFechaTicket(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function parseCategoria(v: unknown): CategoriaTicket {
  const s = String(v ?? '')
  if (s === 'bug' || s === 'sugerencia' || s === 'facturacion' || s === 'otro') return s
  return 'consulta'
}

function parsePrioridad(v: unknown): PrioridadTicket {
  const s = String(v ?? '')
  if (s === 'baja' || s === 'alta' || s === 'urgente') return s
  return 'media'
}

function parseEstado(v: unknown): EstadoTicket {
  const s = String(v ?? '')
  if (s === 'en_proceso' || s === 'resuelto' || s === 'cerrado') return s
  return 'abierto'
}

function filaDeRow(row: Record<string, unknown>): TicketFila {
  return {
    id: String(row.id),
    numero_ticket: String(row.numero_ticket ?? '—'),
    asunto: String(row.asunto ?? ''),
    categoria: parseCategoria(row.categoria),
    prioridad: parsePrioridad(row.prioridad),
    estado: parseEstado(row.estado),
    created_at: String(row.created_at ?? ''),
    empresa_id: row.empresa_id ? String(row.empresa_id) : undefined,
    empresa_nombre: row.empresa_nombre ? String(row.empresa_nombre) : undefined,
  }
}

export async function listarTicketsEmpresa(
  client: SupabaseClient,
): Promise<{ filas: TicketFila[]; error: string | null }> {
  const { data, error } = await client
    .from('tickets')
    .select('id, numero_ticket, asunto, categoria, prioridad, estado, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    return { filas: [], error: esFaltaSql(error) ? MSG_SQL : error.message }
  }
  return { filas: (data ?? []).map((r) => filaDeRow(r as Record<string, unknown>)), error: null }
}

export async function listarTicketsAdmin(
  client: SupabaseClient,
): Promise<{ filas: TicketFila[]; error: string | null }> {
  const { data, error } = await client.rpc('admin_listar_tickets')
  if (error) {
    return { filas: [], error: esFaltaSql(error) ? MSG_SQL : error.message }
  }
  const rows = Array.isArray(data) ? data : []
  return { filas: rows.map((r) => filaDeRow(r as Record<string, unknown>)), error: null }
}

function parseFicha(raw: unknown): TicketFicha | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!row.id) return null
  const respuestasRaw = Array.isArray(row.respuestas) ? row.respuestas : []
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id ?? ''),
    usuario_id: row.usuario_id ? String(row.usuario_id) : null,
    numero_ticket: String(row.numero_ticket ?? '—'),
    asunto: String(row.asunto ?? ''),
    descripcion: String(row.descripcion ?? ''),
    categoria: parseCategoria(row.categoria),
    prioridad: parsePrioridad(row.prioridad),
    estado: parseEstado(row.estado),
    visto_cliente_at: row.visto_cliente_at ? String(row.visto_cliente_at) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    empresa_nombre: String(row.empresa_nombre ?? ''),
    usuario_nombre: row.usuario_nombre ? String(row.usuario_nombre) : null,
    usuario_email: row.usuario_email ? String(row.usuario_email) : null,
    respuestas: respuestasRaw.map((item) => {
      const r = item as Record<string, unknown>
      return {
        id: String(r.id),
        ticket_id: String(r.ticket_id ?? row.id),
        autor_id: r.autor_id ? String(r.autor_id) : null,
        es_admin: Boolean(r.es_admin),
        contenido: String(r.contenido ?? ''),
        created_at: String(r.created_at ?? ''),
      }
    }),
  }
}

export async function obtenerFichaTicket(
  client: SupabaseClient,
  id: string,
): Promise<{ ficha: TicketFicha | null; error: string | null }> {
  const { data, error } = await client.rpc('ficha_ticket', { p_id: id })
  if (error) {
    return { ficha: null, error: esFaltaSql(error) ? MSG_SQL : error.message }
  }
  const ficha = parseFicha(data)
  if (!ficha) return { ficha: null, error: 'No se encontró el ticket.' }
  return { ficha, error: null }
}

export async function crearTicket(
  client: SupabaseClient,
  input: {
    asunto: string
    descripcion: string
    categoria: CategoriaTicket
    prioridad: PrioridadTicket
    empresaNombre: string
  },
): Promise<{ ticket: TicketFila | null; error: string | null }> {
  const asunto = input.asunto.trim()
  const descripcion = input.descripcion.trim()
  if (!asunto) return { ticket: null, error: 'El asunto es obligatorio.' }
  if (descripcion.length < 20) {
    return { ticket: null, error: 'La descripción debe tener al menos 20 caracteres.' }
  }
  const { data, error } = await client
    .from('tickets')
    .insert({
      asunto,
      descripcion,
      categoria: input.categoria,
      prioridad: input.prioridad,
    })
    .select('id, numero_ticket, asunto, categoria, prioridad, estado, created_at')
    .single()
  if (error || !data) {
    return { ticket: null, error: error && esFaltaSql(error) ? MSG_SQL : error?.message ?? 'No se pudo crear el ticket.' }
  }
  const ticket = filaDeRow(data as Record<string, unknown>)
  void avisarNuevoTicketAdmin({
    numero: ticket.numero_ticket,
    empresa: input.empresaNombre,
    asunto: ticket.asunto,
    categoria: etiquetaCategoria(ticket.categoria),
    prioridad: etiquetaPrioridad(ticket.prioridad),
    descripcion,
  })
  return { ticket, error: null }
}

export async function enviarRespuestaTicket(
  client: SupabaseClient,
  ticketId: string,
  contenido: string,
  opts?: { esAdmin?: boolean },
): Promise<string | null> {
  const texto = contenido.trim()
  if (!texto) return 'Escribí una respuesta.'
  const { error } = await client.from('tickets_respuestas').insert({
    ticket_id: ticketId,
    contenido: texto,
  })
  if (error) return esFaltaSql(error) ? MSG_SQL : error.message
  if (opts?.esAdmin) {
    await client.from('tickets').update({ visto_cliente_at: null }).eq('id', ticketId)
  }
  return null
}

export async function cambiarEstadoTicket(
  client: SupabaseClient,
  ticketId: string,
  estado: EstadoTicket,
): Promise<string | null> {
  const { error } = await client.from('tickets').update({ estado }).eq('id', ticketId)
  if (error) return esFaltaSql(error) ? MSG_SQL : error.message
  return null
}

export async function marcarTicketVisto(client: SupabaseClient, ticketId: string): Promise<void> {
  await client.from('tickets').update({ visto_cliente_at: new Date().toISOString() }).eq('id', ticketId)
  avisarSoporteNotif()
}

export const EVENTO_SOPORTE_NOTIF = 'analitica-soporte-notif'

export function avisarSoporteNotif() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENTO_SOPORTE_NOTIF))
}

function ticketConRespuestaAdminNoLeida(row: Record<string, unknown>) {
  const reps = Array.isArray(row.tickets_respuestas) ? row.tickets_respuestas : []
  const admin = reps
    .map((item) => {
      const x = item as Record<string, unknown>
      return { es_admin: Boolean(x.es_admin), created_at: String(x.created_at ?? '') }
    })
    .filter((r) => r.es_admin)
  if (admin.length === 0) return false
  const visto = row.visto_cliente_at ? String(row.visto_cliente_at) : null
  if (!visto) return true
  const ultima = admin.reduce((a, b) => (a.created_at > b.created_at ? a : b))
  return ultima.created_at > visto
}

export async function contarTicketsNoLeidos(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from('tickets')
    .select('id, visto_cliente_at, tickets_respuestas(es_admin, created_at)')
    .limit(200)
  if (error || !data) return 0
  return data.filter((row) => ticketConRespuestaAdminNoLeida(row as Record<string, unknown>)).length
}

export async function marcarTicketsSoporteVistos(client: SupabaseClient): Promise<void> {
  const { data } = await client
    .from('tickets')
    .select('id, visto_cliente_at, tickets_respuestas(es_admin, created_at)')
    .limit(200)
  const ids = (data ?? [])
    .filter((row) => ticketConRespuestaAdminNoLeida(row as Record<string, unknown>))
    .map((row) => String((row as { id: string }).id))
  if (ids.length === 0) return
  const ahora = new Date().toISOString()
  await client.from('tickets').update({ visto_cliente_at: ahora }).in('id', ids)
  avisarSoporteNotif()
}

export async function bannerTicketsHome(client: SupabaseClient): Promise<BannerTicketHome | null> {
  const { data, error } = await client
    .from('tickets')
    .select('id, numero_ticket, estado, visto_cliente_at, tickets_respuestas(es_admin, created_at)')
    .in('estado', ['abierto', 'en_proceso'])
    .order('created_at', { ascending: false })
    .limit(20)
  if (error || !data?.length) return null

  type Mini = {
    id: string
    numero: string
    visto: string | null
    respuestas: { es_admin: boolean; created_at: string }[]
  }
  const tickets: Mini[] = data.map((row) => {
    const r = row as Record<string, unknown>
    const reps = Array.isArray(r.tickets_respuestas) ? r.tickets_respuestas : []
    return {
      id: String(r.id),
      numero: String(r.numero_ticket ?? '—'),
      visto: r.visto_cliente_at ? String(r.visto_cliente_at) : null,
      respuestas: reps
        .map((item) => {
          const x = item as Record<string, unknown>
          return { es_admin: Boolean(x.es_admin), created_at: String(x.created_at ?? '') }
        })
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }
  })

  for (const t of tickets) {
    const ultima = t.respuestas[t.respuestas.length - 1]
    if (!ultima?.es_admin) continue
    const esNueva = !t.visto || ultima.created_at > t.visto
    if (esNueva) return { tipo: 'respuesta', id: t.id, numero: t.numero }
  }
  const sinAdmin = tickets.find((t) => !t.respuestas.some((r) => r.es_admin))
  if (sinAdmin) return { tipo: 'revision', id: sinAdmin.id, numero: sinAdmin.numero }
  return null
}

/**
 * Notifica al admin un ticket nuevo.
 * TODO: desplegar Edge Function `notificar-ticket` (Resend / SMTP) y descomentar el invoke.
 * Auth de Supabase no envía este mail; hace falta un servicio de transaccionales.
 */
export async function avisarNuevoTicketAdmin(payload: {
  numero: string
  empresa: string
  asunto: string
  categoria: string
  prioridad: string
  descripcion: string
}): Promise<void> {
  const destino = import.meta.env.VITE_ADMIN_EMAIL?.trim()
  if (!destino) return
  const preview = payload.descripcion.slice(0, 200)
  const asunto = `🎫 Nuevo ticket [${payload.numero}] — [${payload.empresa}] — [${payload.asunto}]`
  const cuerpo = [
    `Empresa: ${payload.empresa}`,
    `Ticket: ${payload.numero}`,
    `Categoría: ${payload.categoria}`,
    `Prioridad: ${payload.prioridad}`,
    `Descripción: ${preview}`,
    '',
    'Ver ticket: https://analitica360.app/admin',
  ].join('\n')
  void destino
  void asunto
  void cuerpo
  // TODO: await client.functions.invoke('notificar-ticket', { body: { to: destino, asunto, cuerpo } })
}

/**
 * Email al cliente cuando responde el admin.
 * TODO: mismo Edge Function `notificar-ticket` con el email del usuario creador.
 */
export async function avisarRespuestaCliente(payload: {
  email: string | null
  nombre: string | null
  numero: string
  ticketId: string
}): Promise<void> {
  if (!payload.email) return
  const asunto = `💬 Respuesta a tu ticket [${payload.numero}]`
  const nombre = payload.nombre?.trim() || 'hola'
  const cuerpo = [
    `Hola ${nombre}, respondimos tu consulta.`,
    `Ver respuesta: https://analitica360.app/soporte/${payload.ticketId}`,
    'El equipo de Analítica 360',
  ].join('\n')
  void asunto
  void cuerpo
  // TODO: await client.functions.invoke('notificar-ticket', { body: { to: payload.email, asunto, cuerpo } })
}
