import type { SupabaseClient } from '@supabase/supabase-js'

export const ETIQUETAS_CLIENTE = ['VIP', 'Mayorista', 'Frecuente', 'Nuevo', 'Inactivo'] as const
export type EtiquetaCliente = (typeof ETIQUETAS_CLIENTE)[number]

export const COLOR_ETIQUETA: Record<string, { bg: string; fg: string }> = {
  VIP: { bg: 'rgba(245,158,11,0.15)', fg: '#F59E0B' },
  Mayorista: { bg: 'rgba(139,92,246,0.15)', fg: '#C4B5FD' },
  Frecuente: { bg: 'rgba(99,102,241,0.18)', fg: '#A5B4FC' },
  Nuevo: { bg: 'rgba(74,222,128,0.12)', fg: '#4ADE80' },
  Inactivo: { bg: 'rgba(148,163,184,0.15)', fg: '#94A3B8' },
}

export const TIPOS_INTERACCION = [
  { id: 'nota', label: 'Nota' },
  { id: 'preferencia', label: 'Preferencia' },
  { id: 'dato_personal', label: 'Dato personal' },
  { id: 'queja', label: 'Queja' },
  { id: 'cumplido', label: 'Cumplido' },
  { id: 'seguimiento', label: 'Seguimiento' },
] as const

export type ClienteFila = {
  id: string
  nombre: string
  telefono: string | null
  ultima_compra: string | null
  total_gastado: number
  cantidad_compras: number
  etiquetas: string[]
}

export type ClienteFicha = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  cumpleanos: string | null
  notas_libres: string | null
  etiquetas: string[]
  stats: {
    total: number
    cantidad: number
    primera: string | null
    ultima: string | null
  }
  ventas: {
    id: string
    fecha: string
    productos: string
    total: number
    forma_pago: string
  }[]
  interacciones: {
    id: string
    tipo: string
    contenido: string
    privado: boolean
    created_at: string
  }[]
}

function txt(v: unknown) {
  if (v == null || v === '') return null
  return String(v)
}

export async function listarClientes(
  client: SupabaseClient,
): Promise<{ filas: ClienteFila[]; error: string | null }> {
  const { data, error } = await client.rpc('listar_clientes_empresa')
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
      return {
        filas: [],
        error: 'Falta crear el CRM en Supabase. Pegá supabase/017_clientes.sql (rol postgres) y recargá.',
      }
    }
    return { filas: [], error: error.message }
  }
  const filas = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    telefono: txt(row.telefono),
    ultima_compra: txt(row.ultima_compra),
    total_gastado: Number(row.total_gastado ?? 0),
    cantidad_compras: Number(row.cantidad_compras ?? 0),
    etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas.map(String) : [],
  }))
  return { filas, error: null }
}

export async function obtenerFichaCliente(
  client: SupabaseClient,
  id: string,
): Promise<{ ficha: ClienteFicha | null; error: string | null }> {
  const { data, error } = await client.rpc('obtener_cliente_ficha', { p_id: id })
  if (error || data == null) return { ficha: null, error: error?.message ?? 'No se encontró el cliente' }
  const row = data as Record<string, unknown>
  const stats = (row.stats ?? {}) as Record<string, unknown>
  const ventas = Array.isArray(row.ventas) ? row.ventas : []
  const notas = Array.isArray(row.interacciones) ? row.interacciones : []
  return {
    ficha: {
      id: String(row.id),
      nombre: String(row.nombre ?? ''),
      telefono: txt(row.telefono),
      email: txt(row.email),
      cumpleanos: txt(row.cumpleanos),
      notas_libres: txt(row.notas_libres),
      etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas.map(String) : [],
      stats: {
        total: Number(stats.total ?? 0),
        cantidad: Number(stats.cantidad ?? 0),
        primera: txt(stats.primera),
        ultima: txt(stats.ultima),
      },
      ventas: ventas.map((item) => {
        const v = item as Record<string, unknown>
        return {
          id: String(v.id),
          fecha: String(v.fecha ?? ''),
          productos: String(v.productos ?? ''),
          total: Number(v.total ?? 0),
          forma_pago: String(v.forma_pago ?? ''),
        }
      }),
      interacciones: notas.map((item) => {
        const n = item as Record<string, unknown>
        return {
          id: String(n.id),
          tipo: String(n.tipo ?? 'nota'),
          contenido: String(n.contenido ?? ''),
          privado: Boolean(n.privado),
          created_at: String(n.created_at ?? ''),
        }
      }),
    },
    error: null,
  }
}

export type ClienteInput = {
  nombre: string
  telefono: string
  email: string
  cumpleanos: string | null
  notasLibres: string
  etiquetas: string[]
}

export async function crearCliente(client: SupabaseClient, input: ClienteInput) {
  const { data, error } = await client.rpc('crear_cliente', {
    p_nombre: input.nombre,
    p_telefono: input.telefono,
    p_email: input.email,
    p_cumpleanos: input.cumpleanos,
    p_notas_libres: input.notasLibres,
    p_etiquetas: input.etiquetas,
  })
  if (error) return { id: null as string | null, error: error.message }
  return { id: data ? String(data) : null, error: null }
}

export async function actualizarCliente(client: SupabaseClient, id: string, input: ClienteInput) {
  const { error } = await client.rpc('actualizar_cliente', {
    p_id: id,
    p_nombre: input.nombre,
    p_telefono: input.telefono,
    p_email: input.email,
    p_cumpleanos: input.cumpleanos,
    p_notas_libres: input.notasLibres,
    p_etiquetas: input.etiquetas,
  })
  return error ? error.message : null
}

export async function agregarInteraccion(
  client: SupabaseClient,
  input: { clienteId: string; tipo: string; contenido: string; privado: boolean },
) {
  const { error } = await client.rpc('agregar_interaccion_cliente', {
    p_cliente_id: input.clienteId,
    p_tipo: input.tipo,
    p_contenido: input.contenido,
    p_privado: input.privado,
  })
  return error ? error.message : null
}

export function cumpleanosAFecha(mes: string, dia: string): string | null {
  const m = Number.parseInt(mes, 10)
  const d = Number.parseInt(dia, 10)
  if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null
  return `2000-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function fechaACumple(iso: string | null) {
  const raw = String(iso ?? '').slice(0, 10)
  const [, m, d] = raw.split('-')
  return { mes: m ? String(Number(m)) : '', dia: d ? String(Number(d)) : '' }
}

export function formatoCumple(iso: string | null) {
  if (!iso) return null
  const { mes, dia } = fechaACumple(iso)
  if (!mes || !dia) return null
  const dt = new Date(2000, Number(mes) - 1, Number(dia))
  return dt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

export function linkWhatsApp(telefono: string | null) {
  if (!telefono) return null
  const n = telefono.replace(/\D/g, '')
  if (n.length < 8) return null
  return `https://wa.me/${n}`
}

export function etiquetaTipo(tipo: string) {
  return TIPOS_INTERACCION.find((t) => t.id === tipo)?.label ?? tipo
}

export type CumpleProximo = {
  id: string
  nombre: string
  dias: number
}

function diasHastaCumple(iso: string, hoy: Date): number | null {
  const raw = String(iso).slice(0, 10)
  const parts = raw.split('-').map(Number)
  const m = parts[1]
  const d = parts[2]
  if (!m || !d) return null
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  let fecha = new Date(hoy.getFullYear(), m - 1, d)
  let diff = Math.round((fecha.getTime() - hoy0.getTime()) / 86400000)
  if (diff < 0) {
    fecha = new Date(hoy.getFullYear() + 1, m - 1, d)
    diff = Math.round((fecha.getTime() - hoy0.getTime()) / 86400000)
  }
  return diff
}

export async function listarCumpleanosProximos(
  client: SupabaseClient,
  horizonteDias = 7,
): Promise<CumpleProximo[]> {
  const { data, error } = await client
    .from('clientes')
    .select('id, nombre, cumpleanos')
    .is('deleted_at', null)
  if (error || !data) return []
  const hoy = new Date()
  return data
    .map((row) => {
      const dias = row.cumpleanos ? diasHastaCumple(String(row.cumpleanos), hoy) : null
      if (dias == null || dias > horizonteDias) return null
      return { id: String(row.id), nombre: String(row.nombre ?? ''), dias }
    })
    .filter((item): item is CumpleProximo => item != null)
    .sort((a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre, 'es'))
}

export function textoCumpleProximo(item: CumpleProximo) {
  if (item.dias === 0) return `${item.nombre} (hoy)`
  if (item.dias === 1) return `${item.nombre} (en 1 día)`
  return `${item.nombre} (en ${item.dias} días)`
}
