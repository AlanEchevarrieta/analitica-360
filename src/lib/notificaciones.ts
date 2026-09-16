import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '../auth'
import type { Perfil } from '../types'
import { tieneAcceso } from './planes'
import { tieneModulo } from './permisos'
import { diasRestantes, estaEnTrial, type SuscripcionActiva } from './suscripcion'
import { requireSupabase, supabase } from './supabase'

export const EVENTO_NOTIF = 'analitica-notif'

export type ConteosNotif = {
  tickets: number
  pedidos: number
  lotes_vencidos: number
  lotes_por_vencer: number
}

export type IdNotif = keyof ConteosNotif | 'trial'

export type ItemNotif = {
  id: IdNotif
  icono: string
  texto: string
  to: string
  tiempo: string
}

const VACIO: ConteosNotif = {
  tickets: 0,
  pedidos: 0,
  lotes_vencidos: 0,
  lotes_por_vencer: 0,
}

const vistosEnSesion = new Map<string, number>()

function claveSeen(empresaId: string) {
  return `analitica-notif-seen:${empresaId}`
}

function leerSeen(empresaId: string): Partial<Record<IdNotif, number>> {
  try {
    const raw = localStorage.getItem(claveSeen(empresaId))
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Record<IdNotif, number>>
  } catch {
    return {}
  }
}

function guardarSeen(empresaId: string, seen: Partial<Record<IdNotif, number>>) {
  try {
    localStorage.setItem(claveSeen(empresaId), JSON.stringify(seen))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENTO_NOTIF))
}

function n(valor: unknown) {
  const x = Number(valor)
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0
}

function tiempoRelativo(clave: string, activo: boolean) {
  if (!activo) {
    vistosEnSesion.delete(clave)
    return 'ahora'
  }
  if (!vistosEnSesion.has(clave)) vistosEnSesion.set(clave, Date.now())
  const min = Math.floor((Date.now() - (vistosEnSesion.get(clave) ?? Date.now())) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)}h`
}

export function puedeVerTicketsNotif(perfil: Perfil | null) {
  const rol = perfil?.usuario.rol
  return rol === 'dueno' || rol === 'administrador'
}

export async function contarNotificaciones(client: SupabaseClient): Promise<ConteosNotif> {
  const { data, error } = await client.rpc('contar_notificaciones')
  if (!error && data && typeof data === 'object') {
    const row = data as Record<string, unknown>
    return {
      tickets: n(row.tickets),
      pedidos: n(row.pedidos),
      lotes_vencidos: n(row.lotes_vencidos),
      lotes_por_vencer: n(row.lotes_por_vencer),
    }
  }
  return VACIO
}

function plural(cant: number, uno: string, muchos: string) {
  return cant === 1 ? uno : muchos
}

export function armarItemsNotif(opts: {
  perfil: Perfil | null
  suscripcion: SuscripcionActiva | null
  conteos: ConteosNotif
  seen: Partial<Record<IdNotif, number>>
}): { items: ItemNotif[]; total: number } {
  const { perfil, suscripcion, conteos, seen } = opts
  const items: ItemNotif[] = []
  let total = 0
  const enTrial = estaEnTrial(suscripcion)
  const plan = perfil?.empresa.plan_actual
  const planOk = (modulo: string) => Boolean(perfil && tieneAcceso(plan ?? '', modulo, enTrial))

  const tickets = puedeVerTicketsNotif(perfil) && planOk('soporte') ? conteos.tickets : 0
  const pedidos = tieneModulo(perfil, 'pedidos') ? conteos.pedidos : 0
  const lotesV = tieneModulo(perfil, 'inventario') ? conteos.lotes_vencidos : 0
  const lotesP = tieneModulo(perfil, 'inventario') ? conteos.lotes_por_vencer : 0
  const dias = enTrial ? diasRestantes(suscripcion?.fecha_vencimiento ?? null) : 0
  const trial = dias > 0 && dias <= 4 ? dias : 0

  if (tickets > 0 && tickets > (seen.tickets ?? 0)) {
    total += tickets
    items.push({
      id: 'tickets',
      icono: '🎫',
      texto: `${tickets} ${plural(tickets, 'ticket pendiente de respuesta', 'tickets pendientes de respuesta')}`,
      to: '/soporte',
      tiempo: tiempoRelativo('tickets', true),
    })
  } else tiempoRelativo('tickets', false)

  if (pedidos > 0 && pedidos > (seen.pedidos ?? 0)) {
    total += pedidos
    items.push({
      id: 'pedidos',
      icono: '📦',
      texto: `${pedidos} ${plural(pedidos, 'pedido nuevo sin preparar', 'pedidos nuevos sin preparar')}`,
      to: '/pedidos',
      tiempo: tiempoRelativo('pedidos', true),
    })
  } else tiempoRelativo('pedidos', false)

  if (lotesV > 0 && lotesV > (seen.lotes_vencidos ?? 0)) {
    total += lotesV
    items.push({
      id: 'lotes_vencidos',
      icono: '🔴',
      texto: `${lotesV} ${plural(lotesV, 'lote vencido', 'lotes vencidos')}`,
      to: '/inventario?tab=lotes&estado=vencido',
      tiempo: tiempoRelativo('lotes_vencidos', true),
    })
  } else tiempoRelativo('lotes_vencidos', false)

  if (lotesP > 0 && lotesP > (seen.lotes_por_vencer ?? 0)) {
    total += lotesP
    items.push({
      id: 'lotes_por_vencer',
      icono: '🟡',
      texto: `${lotesP} ${plural(lotesP, 'lote vence en 30 días', 'lotes vencen en 30 días')}`,
      to: '/inventario?tab=lotes&estado=por_vencer',
      tiempo: tiempoRelativo('lotes_por_vencer', true),
    })
  } else tiempoRelativo('lotes_por_vencer', false)

  if (trial > 0 && trial !== seen.trial) {
    total += 1
    items.push({
      id: 'trial',
      icono: '⏳',
      texto: `Tu trial vence en ${trial} ${plural(trial, 'día', 'días')}`,
      to: '/planes',
      tiempo: tiempoRelativo('trial', true),
    })
  } else tiempoRelativo('trial', false)

  return { items, total }
}

export function useNotificaciones(pathname: string) {
  const { perfil, suscripcion } = useAuth()
  const [conteos, setConteos] = useState<ConteosNotif>(VACIO)
  const [tick, setTick] = useState(0)
  const empresaId = perfil?.empresa.id ?? ''
  const vivo = useRef(true)

  const cargar = useCallback(async () => {
    if (!supabase || !perfil) return
    const c = await contarNotificaciones(requireSupabase())
    if (vivo.current) setConteos(c)
  }, [perfil])

  useEffect(() => {
    vivo.current = true
    if (!perfil || !supabase) return
    void cargar()
    const t = window.setInterval(() => void cargar(), 60_000)
    const onEvt = () => setTick((n) => n + 1)
    window.addEventListener(EVENTO_NOTIF, onEvt)
    return () => {
      vivo.current = false
      window.clearInterval(t)
      window.removeEventListener(EVENTO_NOTIF, onEvt)
    }
  }, [perfil, cargar])

  const seen = empresaId ? leerSeen(empresaId) : {}
  const { items, total } = useMemo(
    () => armarItemsNotif({ perfil, suscripcion, conteos, seen }),
    // tick fuerza recálculo al marcar leídas
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perfil, suscripcion, conteos, tick, empresaId],
  )

  const marcar = useCallback(
    (id: IdNotif) => {
      if (!empresaId) return
      const actual = leerSeen(empresaId)
      if (id === 'trial') {
        const dias = diasRestantes(suscripcion?.fecha_vencimiento ?? null)
        guardarSeen(empresaId, { ...actual, trial: dias })
        return
      }
      guardarSeen(empresaId, { ...actual, [id]: conteos[id] })
    },
    [empresaId, conteos, suscripcion],
  )

  const marcarTodas = useCallback(() => {
    if (!empresaId) return
    const dias = estaEnTrial(suscripcion) ? diasRestantes(suscripcion?.fecha_vencimiento ?? null) : 0
    guardarSeen(empresaId, {
      tickets: conteos.tickets,
      pedidos: conteos.pedidos,
      lotes_vencidos: conteos.lotes_vencidos,
      lotes_por_vencer: conteos.lotes_por_vencer,
      trial: dias || undefined,
    })
  }, [empresaId, conteos, suscripcion])

  useEffect(() => {
    if (!empresaId) return
    if (pathname.startsWith('/soporte')) marcar('tickets')
    if (pathname.startsWith('/pedidos')) marcar('pedidos')
  }, [pathname, empresaId, conteos.tickets, conteos.pedidos, marcar])

  return { items, total, marcar, marcarTodas }
}
