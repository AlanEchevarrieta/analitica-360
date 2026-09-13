import type { SupabaseClient } from '@supabase/supabase-js'
import {
  accesoSoloPedidos,
  accesoTotal,
  parseAcceso,
  type AccesoColaborador,
} from './permisos'
import { parseRol } from './roles'
import type { Rol } from '../types'

export type UsuarioEmpresa = {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  acceso: AccesoColaborador
  invitacionPendiente: boolean
  esInvitacion: boolean
}

function filaDesdeRow(row: Record<string, unknown>, acceso: AccesoColaborador): UsuarioEmpresa {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    email: String(row.email ?? ''),
    rol: parseRol(row.rol),
    activo: Boolean(row.activo),
    acceso,
    invitacionPendiente: Boolean(row.invitacion_pendiente),
    esInvitacion: false,
  }
}

function accesoDePermisos(modulos: unknown, acciones: unknown, rol: Rol): AccesoColaborador {
  if (modulos != null || acciones != null) return parseAcceso(modulos, acciones)
  if (rol === 'dueno') return accesoTotal(true)
  return accesoSoloPedidos()
}

export function filasDesdeListarEquipo(data: unknown): UsuarioEmpresa[] {
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const rol = parseRol(row.rol)
    return filaDesdeRow(row, accesoDePermisos(row.modulos, row.acciones, rol))
  })
}

export async function listarUsuariosEmpresa(
  client: SupabaseClient,
): Promise<{ filas: UsuarioEmpresa[]; error: string | null }> {
  const { data, error } = await client.rpc('listar_equipo')
  if (error) return { filas: [], error: error.message }
  return { filas: filasDesdeListarEquipo(data), error: null }
}

export async function listarColaboradoresActivos(
  client: SupabaseClient,
): Promise<{ filas: UsuarioEmpresa[]; error: string | null }> {
  const res = await listarUsuariosEmpresa(client)
  return {
    filas: res.filas.filter((u) => u.activo && !u.invitacionPendiente && !u.esInvitacion),
    error: res.error,
  }
}

export async function desactivarUsuario(
  client: SupabaseClient,
  usuario: UsuarioEmpresa,
): Promise<string | null> {
  if (usuario.rol === 'dueno' && !usuario.esInvitacion) {
    const { data } = await client.auth.getUser()
    if (data.user?.id === usuario.id) return 'El dueño no se puede desactivar'
  }
  if (usuario.esInvitacion) {
    const { error } = await client
      .from('invitaciones_colaboradores')
      .update({ pendiente: false })
      .eq('id', usuario.id)
    return error ? error.message : null
  }
  const { error } = await client.from('usuarios').update({ activo: false }).eq('id', usuario.id)
  return error ? error.message : null
}

export async function guardarPermisosColaborador(
  client: SupabaseClient,
  usuario: UsuarioEmpresa,
  acceso: AccesoColaborador,
): Promise<string | null> {
  const { data: authData } = await client.auth.getUser()
  if (authData.user?.id === usuario.id) return 'El dueño tiene acceso total'
  if (usuario.esInvitacion) {
    const { error } = await client
      .from('invitaciones_colaboradores')
      .update({ modulos: acceso.modulos, acciones: acceso.acciones })
      .eq('id', usuario.id)
    return error ? error.message : null
  }
  const { error } = await client.rpc('guardar_colaborador_permisos', {
    p_usuario: usuario.id,
    p_modulos: acceso.modulos,
    p_acciones: acceso.acciones,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('could not find') || msg.includes('does not exist') || msg.includes('PGRST202')) {
    return 'Falta el SQL de permisos. Pegá supabase/056_permisos_granulares.sql y supabase/057_listar_equipo.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export async function invitarColaborador(
  client: SupabaseClient,
  input: { email: string; acceso: AccesoColaborador },
): Promise<string | null> {
  const { error } = await client.rpc('invitar_colaborador', {
    p_email: input.email,
    p_modulos: input.acceso.modulos,
    p_acciones: input.acceso.acciones,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('EMAIL_YA_REGISTRADO')) return 'Ese email ya tiene una cuenta en el equipo'
  if (msg.includes('EMAIL_INVALIDO')) return 'El email no es válido'
  if (msg.includes('NO_AUTORIZADO')) return 'Solo el dueño puede invitar'
  if (msg.includes('could not find') || msg.includes('does not exist') || msg.includes('PGRST202')) {
    return 'Falta el SQL de permisos. Pegá TODO supabase/056_permisos_granulares.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export async function aceptarInvitacionColaborador(
  client: SupabaseClient,
  input: { empresaId: string; nombre: string },
): Promise<string | null> {
  const { error } = await client.rpc('aceptar_invitacion_colaborador', {
    p_empresa: input.empresaId,
    p_rol: 'operario',
    p_nombre: input.nombre,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('INVITACION_INVALIDA')) {
    return 'No hay una invitación pendiente para este email. Pedile al dueño que te invite de nuevo.'
  }
  if (msg.includes('YA_TIENE_EMPRESA')) return 'Esta cuenta ya pertenece a una empresa'
  if (msg.includes('could not find') || msg.includes('does not exist') || msg.includes('PGRST202')) {
    return 'Falta el SQL de equipo. Pegá TODO supabase/054_equipo_roles.sql y supabase/056_permisos_granulares.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}
