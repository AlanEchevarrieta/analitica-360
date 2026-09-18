import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClienteFila } from './clientes'
import { formatoFechaDia } from './fechas'
import type { ClienteSegmento, SegmentosClientes } from './segmentosClientes'

export type IdDestinoDifusion =
  | 'todos'
  | 'inactivos'
  | 'en_riesgo'
  | 'vip'
  | 'cumpleanos_mes'
  | 'manual'

export type DestinatarioDifusion = {
  id: string
  nombre: string
  telefono: string | null
}

export type DifusionFila = {
  id: string
  segmento: string
  mensaje: string
  cantidad: number
  fecha: string
}

export const MAX_MENSAJE_DIFUSION = 1000

const EMOJIS = {
  regalo: String.fromCodePoint(0x1f381),
  fuego: String.fromCodePoint(0x1f525),
  circo: String.fromCodePoint(0x1f3aa),
  caja: String.fromCodePoint(0x1f4e6),
  alerta: `${String.fromCodePoint(0x26a0)}${String.fromCodePoint(0xfe0f)}`,
  sonrisa: String.fromCodePoint(0x1f60a),
  fiesta: String.fromCodePoint(0x1f389),
  mate: String.fromCodePoint(0x1f9c9),
}

export const LINK_TIENDA_FALLBACK = 'https://analitica360.app'

export const VARIABLES_DIFUSION = [
  { id: 'nombre', chip: '{nombre}' },
  { id: 'empresa', chip: '{empresa}' },
  { id: 'fecha', chip: '{fecha}' },
  { id: 'link_tienda', chip: '{link_tienda}' },
] as const

export const PLANTILLAS_DIFUSION: { id: string; label: string; texto: string }[] = [
  {
    id: 'cupon',
    label: 'Cupón de descuento',
    texto: `Hola {nombre}! Te tenemos una sorpresa ${EMOJIS.regalo}\nEsta semana tenés un descuento especial esperándote en {empresa}.\n¿Querés que te cuente más?`,
  },
  {
    id: 'hotsale',
    label: 'Hot Sale / Liquidación',
    texto: `Hola {nombre}! ${EMOJIS.fuego} Arrancó nuestra liquidación en {empresa}.\nPrecios increíbles por tiempo limitado.\n¡No te lo pierdas!`,
  },
  {
    id: 'evento',
    label: 'Invitación a evento',
    texto: `Hola {nombre}! Te invitamos a nuestro próximo evento en {empresa} ${EMOJIS.circo}\nVa a haber novedades y ofertas exclusivas.\n¿Te anotamos?`,
  },
  {
    id: 'novedad',
    label: 'Novedad de productos',
    texto: `Hola {nombre}! ${EMOJIS.caja} Llegó algo nuevo a {empresa} que sabemos que te va a encantar.\n¿Te mandamos las fotos?`,
  },
  {
    id: 'stock',
    label: 'Stock limitado',
    texto: `Hola {nombre}! ${EMOJIS.alerta} Quedan pocas unidades de nuestros productos más pedidos en {empresa}.\n¿Separamos uno para vos?`,
  },
  {
    id: 'postcompra',
    label: 'Seguimiento post-compra',
    texto: `Hola {nombre}! ¿Cómo andás?\nQueríamos saber si quedaste conforme con tu última compra en {empresa}.\nTu opinión nos importa ${EMOJIS.sonrisa}`,
  },
  {
    id: 'fecha',
    label: 'Fecha especial',
    texto: `Hola {nombre}! Se viene una fecha especial ${EMOJIS.regalo}\nEn {empresa} tenemos el regalo perfecto.\n¿Te ayudamos a elegir?`,
  },
  {
    id: 'reactivacion',
    label: 'Reactivación',
    texto: `Hola {nombre}! Hace tiempo que no sabemos de vos.\nTe extrañamos en {empresa} ${EMOJIS.mate}\n¿Hay algo en lo que podamos ayudarte?`,
  },
  {
    id: 'bienvenida',
    label: 'Bienvenida',
    texto: `Hola {nombre}! Bienvenido/a a {empresa} ${EMOJIS.fiesta}\nGracias por elegirnos — somos un equipo apasionado y estamos acá para lo que necesites.\nPodés ver todos nuestros productos en: {link_tienda}\nCualquier consulta escribinos, con gusto te ayudamos ${EMOJIS.sonrisa}`,
  },
]

export const ETIQUETA_SEGMENTO_DIFUSION: Record<IdDestinoDifusion, string> = {
  todos: 'Todos los clientes',
  inactivos: 'Clientes inactivos +60 días',
  en_riesgo: 'Clientes en riesgo 30-60 días',
  vip: 'Clientes VIP',
  cumpleanos_mes: 'Cumpleaños este mes',
  manual: 'Selección manual',
}

export function fechaHoyDifusion() {
  return formatoFechaDia(new Date().toISOString())
}

export function interpolarMensaje(
  plantilla: string,
  ctx: { nombre: string; empresa: string; fecha: string; linkTienda: string },
) {
  return plantilla
    .replaceAll('{nombre}', ctx.nombre)
    .replaceAll('{empresa}', ctx.empresa)
    .replaceAll('{fecha}', ctx.fecha)
    .replaceAll('{link_tienda}', ctx.linkTienda)
    .replaceAll('[empresa]', ctx.empresa)
}

export function normalizarLinkTienda(raw: unknown) {
  const t = String(raw ?? '').trim()
  if (!t) return LINK_TIENDA_FALLBACK
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export async function cargarLinkTienda(
  client: SupabaseClient,
  empresaId: string,
): Promise<string> {
  const cfg = await client
    .from('configuracion_empresa')
    .select('url_tienda')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!cfg.error) {
    const row = cfg.data as { url_tienda?: unknown } | null
    if (row?.url_tienda) return normalizarLinkTienda(row.url_tienda)
  }
  const emp = await client.from('empresas').select('url_tienda').eq('id', empresaId).maybeSingle()
  if (!emp.error) {
    const row = emp.data as { url_tienda?: unknown } | null
    if (row?.url_tienda) return normalizarLinkTienda(row.url_tienda)
  }
  return LINK_TIENDA_FALLBACK
}

export function telefonoWhatsApp(tel: string | null) {
  const n = (tel ?? '').replace(/\D/g, '')
  return n.length >= 8 ? n : null
}

export function conTelefono(list: DestinatarioDifusion[]) {
  return list.filter((c) => telefonoWhatsApp(c.telefono))
}

export function linkWhatsAppDifusion(tel: string, mensaje: string) {
  const n = telefonoWhatsApp(tel)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`
}

function deFila(c: ClienteFila): DestinatarioDifusion {
  return { id: c.id, nombre: c.nombre, telefono: c.telefono }
}

function deSeg(c: ClienteSegmento): DestinatarioDifusion {
  return { id: c.id, nombre: c.nombre, telefono: c.telefono }
}

export function destinatariosDifusion(input: {
  destino: IdDestinoDifusion
  clientes: ClienteFila[]
  segmentos: SegmentosClientes | null
  cumpleMes: DestinatarioDifusion[]
  idsManual: Set<string>
}): DestinatarioDifusion[] {
  const { destino, clientes, segmentos, cumpleMes, idsManual } = input
  if (destino === 'todos') return clientes.map(deFila)
  if (destino === 'manual') return clientes.filter((c) => idsManual.has(c.id)).map(deFila)
  if (destino === 'cumpleanos_mes') return cumpleMes
  if (!segmentos) return []
  if (destino === 'inactivos') return segmentos.inactivos.map(deSeg)
  if (destino === 'en_riesgo') return segmentos.en_riesgo.map(deSeg)
  return segmentos.vip.map(deSeg)
}

export function mesActualMendoza() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Mendoza',
    month: 'numeric',
  }).formatToParts(new Date())
  return Number(parts.find((p) => p.type === 'month')?.value ?? 0)
}

export async function cargarCumpleanosMes(
  client: SupabaseClient,
): Promise<DestinatarioDifusion[]> {
  const { data, error } = await client
    .from('clientes')
    .select('id, nombre, telefono, cumpleanos')
    .is('deleted_at', null)
  if (error || !data) return []
  const mes = mesActualMendoza()
  return data
    .map((row) => {
      const raw = String(row.cumpleanos ?? '')
      const m = raw.match(/^\d{4}-(\d{2})-/)
      const mesCli = m ? Number(m[1]) : NaN
      if (mesCli !== mes) return null
      return {
        id: String(row.id),
        nombre: String(row.nombre ?? ''),
        telefono: row.telefono == null || row.telefono === '' ? null : String(row.telefono),
      }
    })
    .filter((c): c is DestinatarioDifusion => c != null)
}

export async function listarDifusiones(
  client: SupabaseClient,
): Promise<{ filas: DifusionFila[]; error: string | null }> {
  const { data, error } = await client
    .from('difusiones')
    .select('id, segmento, mensaje, cantidad_destinatarios, fecha')
    .is('deleted_at', null)
    .order('fecha', { ascending: false })
    .limit(50)
  if (error) {
    const t = error.message.toLowerCase()
    if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
      return {
        filas: [],
        error: 'Falta crear las difusiones. Pegá supabase/066_difusiones.sql (rol postgres) y recargá.',
      }
    }
    return { filas: [], error: error.message }
  }
  return {
    filas: (data ?? []).map((row) => ({
      id: String(row.id),
      segmento: String(row.segmento ?? ''),
      mensaje: String(row.mensaje ?? ''),
      cantidad: Number(row.cantidad_destinatarios ?? 0) || 0,
      fecha: String(row.fecha ?? ''),
    })),
    error: null,
  }
}

export async function guardarDifusion(
  client: SupabaseClient,
  input: {
    empresaId: string
    usuarioId: string
    segmento: IdDestinoDifusion
    mensaje: string
    cantidad: number
  },
): Promise<string | null> {
  const { error } = await client.from('difusiones').insert({
    empresa_id: input.empresaId,
    usuario_id: input.usuarioId,
    segmento: input.segmento,
    mensaje: input.mensaje,
    cantidad_destinatarios: input.cantidad,
  })
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta crear las difusiones. Pegá supabase/066_difusiones.sql (rol postgres) y recargá.'
  }
  return error.message
}
