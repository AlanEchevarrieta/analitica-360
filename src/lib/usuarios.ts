import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePermisos, type Permisos } from './permisos'
import type { Rol } from '../types'

export type UsuarioEmpresa = {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  permisos: Permisos
}

export async function listarUsuariosEmpresa(
  client: SupabaseClient,
): Promise<{ filas: UsuarioEmpresa[]; error: string | null }> {
  const { data, error } = await client
    .from('usuarios')
    .select('id, nombre, email, rol, activo, permisos')
    .is('deleted_at', null)
    .order('nombre')

  if (error) return { filas: [], error: error.message }
  const filas = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    email: String(row.email ?? ''),
    rol: (row.rol as Rol) ?? 'operador',
    activo: Boolean(row.activo),
    permisos: parsePermisos(row.permisos),
  }))
  return { filas, error: null }
}

export async function desactivarUsuario(
  client: SupabaseClient,
  id: string,
): Promise<string | null> {
  const { error } = await client.from('usuarios').update({ activo: false }).eq('id', id)
  return error ? error.message : null
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
