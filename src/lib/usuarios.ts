import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePermisos, permisosPorRol, type Permisos } from './permisos'
import { etiquetaRol, parseRol, type RolAsignable } from './roles'
import type { Rol } from '../types'

export type UsuarioEmpresa = {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  permisos: Permisos
  invitacionPendiente: boolean
  esInvitacion: boolean
}

export async function listarUsuariosEmpresa(
  client: SupabaseClient,
): Promise<{ filas: UsuarioEmpresa[]; error: string | null }> {
  const { data, error } = await client
    .from('usuarios')
    .select('id, nombre, email, rol, activo, permisos, invitacion_pendiente')
    .is('deleted_at', null)
    .order('nombre')

  if (error) return { filas: [], error: error.message }
  const filas = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    email: String(row.email ?? ''),
    rol: parseRol(row.rol),
    activo: Boolean(row.activo),
    permisos: parsePermisos(row.permisos),
    invitacionPendiente: Boolean(row.invitacion_pendiente),
    esInvitacion: false,
  }))

  const inv = await client
    .from('invitaciones_colaboradores')
    .select('id, email, rol, pendiente')
    .eq('pendiente', true)
    .order('created_at', { ascending: false })

  if (!inv.error) {
    for (const row of (inv.data ?? []) as Record<string, unknown>[]) {
      const email = String(row.email ?? '')
      if (filas.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.activo)) continue
      filas.push({
        id: String(row.id),
        nombre: email.split('@')[0] || 'Invitado',
        email,
        rol: parseRol(row.rol),
        activo: false,
        permisos: permisosPorRol(parseRol(row.rol) === 'administrador' ? 'administrador' : 'operario'),
        invitacionPendiente: true,
        esInvitacion: true,
      })
    }
  }

  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { filas, error: null }
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
  if (usuario.rol === 'dueno') return 'El dueño no se puede desactivar'
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

export async function actualizarRolUsuario(
  client: SupabaseClient,
  usuario: UsuarioEmpresa,
  rol: RolAsignable,
): Promise<string | null> {
  if (usuario.rol === 'dueno') return 'El dueño no se puede editar'
  if (usuario.esInvitacion) {
    const { error } = await client
      .from('invitaciones_colaboradores')
      .update({ rol })
      .eq('id', usuario.id)
    return error ? error.message : null
  }
  const { error } = await client.from('usuarios').update({ rol }).eq('id', usuario.id)
  return error ? error.message : null
}

export async function invitarColaborador(
  client: SupabaseClient,
  input: { email: string; rol: RolAsignable },
): Promise<string | null> {
  const { error } = await client.rpc('invitar_colaborador', {
    p_email: input.email,
    p_rol: input.rol,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('EMAIL_YA_REGISTRADO')) return 'Ese email ya tiene una cuenta en el equipo'
  if (msg.includes('EMAIL_INVALIDO')) return 'El email no es válido'
  if (msg.includes('NO_AUTORIZADO')) return 'Solo el dueño o un administrador pueden invitar'
  if (msg.includes('could not find') || msg.includes('does not exist') || msg.includes('PGRST202')) {
    return 'Falta el SQL de equipo. Pegá TODO supabase/054_equipo_roles.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export async function aceptarInvitacionColaborador(
  client: SupabaseClient,
  input: { empresaId: string; rol: RolAsignable; nombre: string },
): Promise<string | null> {
  const { error } = await client.rpc('aceptar_invitacion_colaborador', {
    p_empresa: input.empresaId,
    p_rol: input.rol,
    p_nombre: input.nombre,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('INVITACION_INVALIDA')) {
    return 'No hay una invitación pendiente para este email. Pedile al dueño que te invite de nuevo.'
  }
  if (msg.includes('YA_TIENE_EMPRESA')) return 'Esta cuenta ya pertenece a una empresa'
  if (msg.includes('could not find') || msg.includes('does not exist') || msg.includes('PGRST202')) {
    return 'Falta el SQL de equipo. Pegá TODO supabase/054_equipo_roles.sql (rol postgres), dale Run y recargá.'
  }
  return msg
}

export async function crearUsuarioEmpresa(
  client: SupabaseClient,
  input: {
    nombre: string
    email: string
    password: string
    rol: 'operador' | 'visor'
    permisos: Permisos
  },
): Promise<string | null> {
  const { error } = await client.rpc('crear_usuario_empresa', {
    p_nombre: input.nombre,
    p_email: input.email,
    p_password: input.password,
    p_rol: input.rol,
    p_permisos: input.permisos,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('EMAIL_YA_REGISTRADO')) return 'Ese email ya tiene una cuenta'
  if (msg.includes('EMAIL_INVALIDO')) return 'El email no es válido'
  if (msg.includes('PASSWORD_INVALIDA')) return 'La contraseña es demasiado corta'
  if (msg.includes('NO_AUTORIZADO')) return 'Solo el dueño puede crear usuarios'
  if (msg.includes('could not find') || msg.includes('does not exist') || msg.includes('PGRST202')) {
    return 'No se pudo crear el usuario. Corré supabase/011_crear_usuario_empresa.sql en el SQL Editor.'
  }
  return msg
}

export { etiquetaRol }
