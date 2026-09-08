import type { SupabaseClient } from '@supabase/supabase-js'
import { ordenarPlanesAdmin } from './planes'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function masDiasISO(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export async function iniciarPeriodoPrueba(
  client: SupabaseClient,
  empresaId: string,
  usuarioId: string,
): Promise<string | null> {
  const { data: existente } = await client
    .from('suscripciones')
    .select('id')
    .eq('empresa_id', empresaId)
    .limit(1)
    .maybeSingle()

  if (existente) return null

  const { data: plan, error: planError } = await client
    .from('planes')
    .select('id')
    .eq('nombre', 'starter')
    .maybeSingle()

  if (planError || !plan?.id) {
    return 'No se encontró el plan starter'
  }

  const { error: subError } = await client.from('suscripciones').insert({
    empresa_id: empresaId,
    plan_id: plan.id,
    estado: 'periodo_prueba',
    fecha_inicio: hoyISO(),
    fecha_vencimiento: masDiasISO(14),
  })

  if (subError) return 'No se pudo crear el período de prueba'
  return registrarAceptacionTerminos(client, empresaId, usuarioId)
}

export async function registrarAceptacionTerminos(
  client: SupabaseClient,
  empresaId: string,
  usuarioId: string,
): Promise<string | null> {
  const { data: existente } = await client
    .from('aceptaciones_terminos')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .eq('version', '1.0')
    .maybeSingle()

  if (existente) {
    console.log('T&C registrado OK')
    return null
  }

  const { error } = await client.from('aceptaciones_terminos').insert({
    empresa_id: empresaId,
    usuario_id: usuarioId,
    version: '1.0',
    user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
  })

  if (error) {
    console.error('T&C error:', error.message)
    return 'No se pudo registrar la aceptación de términos'
  }
  console.log('T&C registrado OK')
  return null
}

export type SuscripcionActiva = {
  id: string
  estado: string
  fecha_vencimiento: string | null
}

export async function leerSuscripcionActiva(
  client: SupabaseClient,
  empresaId: string,
): Promise<SuscripcionActiva | null> {
  const rpc = await client.rpc('mi_suscripcion_activa')
  if (!rpc.error) {
    const fila = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
    if (fila && (fila.estado || fila.suscripcion_id)) {
      return {
        id: fila.suscripcion_id ?? fila.id,
        estado: fila.estado,
        fecha_vencimiento: fila.fecha_vencimiento,
      }
    }
  }

  const { data, error } = await client
    .from('suscripciones')
    .select('id, estado, fecha_vencimiento')
    .eq('empresa_id', empresaId)
    .order('fecha_vencimiento', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('suscripcion:', error.message)
    return null
  }
  if (!data) return null
  return {
    id: data.id,
    estado: data.estado,
    fecha_vencimiento: data.fecha_vencimiento,
  }
}

export function diasRestantes(fechaVencimiento: string | null): number {
  if (!fechaVencimiento) return 0
  const fin = new Date(`${fechaVencimiento}T00:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000))
}

export function esAdminEmail(email: string | undefined | null): boolean {
  const esperado = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()
  if (!esperado || !email) return false
  return email.trim().toLowerCase() === esperado
}

export type PlanAdmin = { id: string; nombre: string }

export type FilaAdminSuscripcion = {
  suscripcion_id: string | null
  empresa_id: string
  empresa_nombre: string
  estado: string | null
  fecha_vencimiento: string | null
  plan_nombre: string | null
  plan_actual?: string | null
}

function soloFecha(valor: string) {
  return valor.slice(0, 10)
}

export async function listarPlanesAdmin(client: SupabaseClient): Promise<PlanAdmin[]> {
  const tabla = await client.from('planes').select('id, nombre').order('nombre')
  if (!tabla.error && tabla.data?.length) {
    return ordenarPlanesAdmin(tabla.data as PlanAdmin[])
  }
  const rpc = await client.rpc('admin_listar_planes')
  return ordenarPlanesAdmin((rpc.data ?? []) as PlanAdmin[])
}

export async function listarSuscripcionesAdmin(
  client: SupabaseClient,
): Promise<{ filas: FilaAdminSuscripcion[]; error: string | null }> {
  const { data, error } = await client.rpc('admin_listar_suscripciones')
  if (error) {
    return { filas: [], error: error.message }
  }
  return { filas: (data ?? []) as FilaAdminSuscripcion[], error: null }
}

export async function asignarSuscripcionAdmin(
  client: SupabaseClient,
  params: { empresaId: string; planId: string; fechaVencimiento: string },
): Promise<string | null> {
  const { error } = await client.rpc('admin_asignar_suscripcion', {
    p_empresa_id: params.empresaId,
    p_plan_id: params.planId,
    p_fecha_vencimiento: soloFecha(params.fechaVencimiento),
  })
  if (!error) return null
  const detalle = [error.message, error.details, error.hint].filter(Boolean).join(' — ')
  return detalle || 'No se pudo asignar la suscripción'
}

export async function cambiarEstadoSuscripcionAdmin(
  client: SupabaseClient,
  suscripcionId: string,
  estado: string,
): Promise<string | null> {
  const { error } = await client.rpc('admin_cambiar_estado_suscripcion', {
    p_suscripcion_id: suscripcionId,
    p_estado: estado,
  })
  return error ? error.message : null
}
