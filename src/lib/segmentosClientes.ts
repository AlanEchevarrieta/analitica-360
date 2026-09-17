import type { SupabaseClient } from '@supabase/supabase-js'
import { formatoCumple, linkWhatsApp } from './clientes'
import { formatoARS } from './productos'

export const EVENTO_SEGMENTOS_CRM = 'analitica-segmentos-crm'

export type IdSegmento = 'inactivos' | 'en_riesgo' | 'cumpleanos' | 'vip'

export type ClienteSegmento = {
  id: string
  nombre: string
  telefono: string | null
  dias: number | null
  ultima_compra: string | null
  fecha_nacimiento: string | null
  total_facturado: number | null
  total_compras: number | null
}

export type SegmentosClientes = {
  inactivos: ClienteSegmento[]
  en_riesgo: ClienteSegmento[]
  cumpleanos: ClienteSegmento[]
  vip: ClienteSegmento[]
  conteos: Record<IdSegmento, number>
}

const VACIO: SegmentosClientes = {
  inactivos: [],
  en_riesgo: [],
  cumpleanos: [],
  vip: [],
  conteos: { inactivos: 0, en_riesgo: 0, cumpleanos: 0, vip: 0 },
}

function txt(v: unknown) {
  if (v == null || v === '') return null
  return String(v)
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapFila(row: Record<string, unknown>): ClienteSegmento {
  return {
    id: String(row.id ?? ''),
    nombre: String(row.nombre ?? ''),
    telefono: txt(row.telefono),
    dias: num(row.dias),
    ultima_compra: txt(row.ultima_compra),
    fecha_nacimiento: txt(row.fecha_nacimiento),
    total_facturado: num(row.total_facturado),
    total_compras: num(row.total_compras),
  }
}

function mapLista(raw: unknown): ClienteSegmento[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => mapFila((r ?? {}) as Record<string, unknown>)).filter((c) => c.id)
}

export async function cargarSegmentosClientes(
  client: SupabaseClient,
): Promise<{ data: SegmentosClientes; error: string | null }> {
  const { data, error } = await client.rpc('segmentos_clientes')
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
      return {
        data: VACIO,
        error: 'Falta crear los segmentos. Pegá supabase/065_segmentos_clientes.sql (rol postgres) y recargá.',
      }
    }
    return { data: VACIO, error: error.message }
  }
  const row = (data ?? {}) as Record<string, unknown>
  const conteosRaw = (row.conteos ?? {}) as Record<string, unknown>
  const dataOk: SegmentosClientes = {
    inactivos: mapLista(row.inactivos),
    en_riesgo: mapLista(row.en_riesgo),
    cumpleanos: mapLista(row.cumpleanos),
    vip: mapLista(row.vip),
    conteos: {
      inactivos: Number(conteosRaw.inactivos ?? 0) || 0,
      en_riesgo: Number(conteosRaw.en_riesgo ?? 0) || 0,
      cumpleanos: Number(conteosRaw.cumpleanos ?? 0) || 0,
      vip: Number(conteosRaw.vip ?? 0) || 0,
    },
  }
  return { data: dataOk, error: null }
}

export function alertaCrm(conteos: Record<IdSegmento, number>) {
  return (conteos.inactivos ?? 0) + (conteos.en_riesgo ?? 0)
}

export function mensajeSegmento(id: IdSegmento, nombre: string, marca: string) {
  const n = nombre.trim() || 'ahí'
  const shop = marca.trim() || 'Acacia'
  if (id === 'inactivos') {
    return `Hola ${n}! 👋 Hace un tiempo que no sabemos de vos.\nTe extrañamos en ${shop} 🧉\n¿Hay algo en lo que podamos ayudarte?\nCualquier consulta estamos acá 😊`
  }
  if (id === 'en_riesgo') {
    return `Hola ${n}! ¿Cómo andás? 😊\nPasamos a saludarte desde ${shop} 🧉\nTenemos novedades que te pueden interesar.\n¿Querés que te contemos?`
  }
  if (id === 'cumpleanos') {
    return `🎂 ¡Feliz cumpleaños ${n}!\nTodo el equipo de ${shop} te desea un día increíble 🎉🧉\nGracias por elegirnos — sos parte de nuestra comunidad!`
  }
  return `Hola ${n}! 💫\nQueremos agradecerte por tu fidelidad con ${shop} 🧉\nSos uno de nuestros clientes más especiales\ny queremos que lo sepas.\n¡Gracias por elegirnos siempre! 😊`
}

export function linkWhatsAppSegmento(id: IdSegmento, cliente: ClienteSegmento, marca: string) {
  return linkWhatsApp(cliente.telefono, mensajeSegmento(id, cliente.nombre, marca))
}

export function detalleSegmento(id: IdSegmento, c: ClienteSegmento) {
  if (id === 'inactivos' || id === 'en_riesgo') {
    if (c.dias == null) return 'Sin compras registradas'
    return `${c.dias} ${c.dias === 1 ? 'día' : 'días'} sin comprar`
  }
  if (id === 'cumpleanos') return formatoCumple(c.fecha_nacimiento) ?? 'Cumpleaños esta semana'
  if (c.total_facturado != null) return `${formatoARS(c.total_facturado)} · ${c.total_compras ?? 0} compras`
  return 'Cliente VIP'
}

export const META_SEGMENTO: Record<
  IdSegmento,
  { icono: string; titulo: string; sub: string; accion: string; borde: string }
> = {
  inactivos: {
    icono: '🔴',
    titulo: 'Inactivos',
    sub: '+60 días',
    accion: 'Ver lista',
    borde: '#EF4444',
  },
  en_riesgo: {
    icono: '🟡',
    titulo: 'En riesgo',
    sub: '30-60d',
    accion: 'Ver lista',
    borde: '#EAB308',
  },
  cumpleanos: {
    icono: '🎂',
    titulo: 'Cumples',
    sub: 'esta sem',
    accion: 'Saludar',
    borde: '#A855F7',
  },
  vip: {
    icono: '⭐',
    titulo: 'VIP',
    sub: 'top clientes',
    accion: 'Ver lista',
    borde: '#F59E0B',
  },
}
