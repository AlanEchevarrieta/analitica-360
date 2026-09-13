import type { Permisos } from './lib/permisos'

export type Rol = 'dueno' | 'administrador' | 'operario'

export type Empresa = {
  id: string
  nombre: string
  rubro: string | null
  plan_actual: string
  activo: boolean
}

export type Usuario = {
  id: string
  empresa_id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  permisos: Permisos
}

export type Perfil = {
  usuario: Usuario
  empresa: Empresa
}
