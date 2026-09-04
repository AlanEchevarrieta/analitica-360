export type Rol = 'dueno' | 'operador' | 'visor'

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
}

export type Perfil = {
  usuario: Usuario
  empresa: Empresa
}
