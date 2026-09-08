import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  guardarAltaPendiente,
  leerAltaPendiente,
  limpiarAltaPendiente,
} from './lib/altaPendiente'
import { requireSupabase, supabase, supabaseConfigured } from './lib/supabase'
import { iniciarPeriodoPrueba, registrarAceptacionTerminos } from './lib/suscripcion'
import { parsePermisos, PERMISOS_DUENO } from './lib/permisos'
import type { Empresa, Perfil, Usuario } from './types'

function userAgentActual() {
  return typeof navigator === 'undefined' ? null : navigator.userAgent
}

async function rpcRegistrarEmpresa(
  client: ReturnType<typeof requireSupabase>,
  input: { nombreEmpresa: string; rubro: string; nombreUsuario: string },
) {
  const base = {
    p_nombre_empresa: input.nombreEmpresa,
    p_rubro: input.rubro,
    p_nombre_usuario: input.nombreUsuario,
  }
  const conAgente = await client.rpc('registrar_empresa', {
    ...base,
    p_user_agent: userAgentActual(),
  })
  if (conAgente.error && /could not find the function|does not exist|PGRST202/i.test(conAgente.error.message)) {
    return client.rpc('registrar_empresa', base)
  }
  return conAgente
}

type AuthContextValue = {
  listo: boolean
  configurado: boolean
  session: Session | null
  perfil: Perfil | null
  error: string | null
  ingresar: (email: string, password: string) => Promise<string | null>
  registrar: (input: {
    email: string
    password: string
    nombreEmpresa: string
    rubro: string
    nombreUsuario: string
  }) => Promise<{ error: string | null; esperaConfirmacion: boolean }>
  completarAlta: (input: {
    nombreEmpresa: string
    rubro: string
    nombreUsuario: string
  }) => Promise<string | null>
  cerrarSesion: () => Promise<void>
  recargarPerfil: () => Promise<void>
  recuperarPassword: (email: string) => Promise<string | null>
  actualizarPassword: (password: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mensajeAuth(error: { message: string; status?: number } | null): string {
  if (!error) return 'No se pudo completar la acción'
  const msg = error.message.toLowerCase()
  if (msg.includes('invalid login')) return 'Email o contraseña incorrectos'
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'Ese email ya tiene una cuenta. Ingresá o usá otro email.'
  }
  if (msg.includes('password')) return 'La contraseña no cumple el mínimo de 8 caracteres'
  if (msg.includes('email')) return 'El email no es válido'
  return 'No se pudo completar la acción. Revisá los datos e intentá de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(!supabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargarPerfil = useCallback(async (userId: string) => {
    const client = requireSupabase()
    const { data, error: qError } = await client
      .from('usuarios')
      .select('id, empresa_id, nombre, email, rol, activo, permisos, empresas (id, nombre, rubro, plan_actual, activo)')
      .eq('id', userId)
      .maybeSingle()

    if (qError) {
      setError('No se pudo leer tu empresa. ¿Corriste el SQL en Supabase?')
      setPerfil(null)
      return
    }

    if (!data) {
      setPerfil(null)
      return
    }

    const empresas = data.empresas as Empresa | Empresa[] | null
    const empresa = Array.isArray(empresas) ? empresas[0] : empresas
    if (!empresa) {
      setPerfil(null)
      return
    }

    const usuario: Usuario = {
      id: data.id,
      empresa_id: data.empresa_id,
      nombre: data.nombre,
      email: data.email,
      rol: data.rol,
      activo: data.activo,
      permisos: data.rol === 'dueno' ? { ...PERMISOS_DUENO } : parsePermisos(data.permisos),
    }
    setPerfil({ usuario, empresa })
    setError(null)
  }, [])

  const intentarAltaPendiente = useCallback(async () => {
    const pendiente = leerAltaPendiente()
    if (!pendiente) return
    const client = requireSupabase()
    const { error: rpcError } = await rpcRegistrarEmpresa(client, pendiente)
    if (rpcError) {
      if (rpcError.message.includes('YA_TIENE_EMPRESA')) {
        limpiarAltaPendiente()
        return
      }
      setError('No se pudo crear la empresa. Revisá que el SQL esté corrido.')
      return
    }
    limpiarAltaPendiente()
    const { data: userData } = await client.auth.getUser()
    const userId = userData.user?.id
    if (userId) {
      const { data: perfilNuevo } = await client
        .from('usuarios')
        .select('id, empresa_id')
        .eq('id', userId)
        .maybeSingle()
      if (perfilNuevo) {
        await iniciarPeriodoPrueba(client, perfilNuevo.empresa_id, perfilNuevo.id)
        await registrarAceptacionTerminos(client, perfilNuevo.empresa_id, perfilNuevo.id)
      }
    }
  }, [])

  useEffect(() => {
    if (!supabase) return

    let cancelado = false

    async function hidratar(next: Session | null) {
      setSession(next)
      if (!next?.user) {
        setPerfil(null)
        setListo(true)
        return
      }
      await intentarAltaPendiente()
      if (cancelado) return
      await cargarPerfil(next.user.id)
      if (!cancelado) setListo(true)
    }

    supabase.auth.getSession().then(({ data }) => {
      void hidratar(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(next)
        return
      }
      void hidratar(next)
    })

    return () => {
      cancelado = true
      sub.subscription.unsubscribe()
    }
  }, [cargarPerfil, intentarAltaPendiente])

  const ingresar = useCallback(async (email: string, password: string) => {
    const client = requireSupabase()
    const { error: authError } = await client.auth.signInWithPassword({ email, password })
    if (authError) return mensajeAuth(authError)
    return null
  }, [])

  const registrar = useCallback(
    async (input: {
      email: string
      password: string
      nombreEmpresa: string
      rubro: string
      nombreUsuario: string
    }) => {
      const client = requireSupabase()
      guardarAltaPendiente({
        nombreEmpresa: input.nombreEmpresa,
        rubro: input.rubro,
        nombreUsuario: input.nombreUsuario,
      })
      const { data, error: authError } = await client.auth.signUp({
        email: input.email,
        password: input.password,
      })
      if (authError) return { error: mensajeAuth(authError), esperaConfirmacion: false }

      if (!data.session) {
        return {
          error: null,
          esperaConfirmacion: true,
        }
      }

      const { error: rpcError } = await rpcRegistrarEmpresa(client, input)
      if (rpcError && !rpcError.message.includes('YA_TIENE_EMPRESA')) {
        return { error: 'La cuenta se creó pero no la empresa. Avisame y lo vemos.', esperaConfirmacion: false }
      }
      limpiarAltaPendiente()
      if (data.user) {
        const { data: perfilNuevo } = await client
          .from('usuarios')
          .select('id, empresa_id')
          .eq('id', data.user.id)
          .maybeSingle()
        if (perfilNuevo) {
          await iniciarPeriodoPrueba(client, perfilNuevo.empresa_id, perfilNuevo.id)
          await registrarAceptacionTerminos(client, perfilNuevo.empresa_id, perfilNuevo.id)
        }
        await cargarPerfil(data.user.id)
      }
      return { error: null, esperaConfirmacion: false }
    },
    [cargarPerfil],
  )

  const completarAlta = useCallback(
    async (input: { nombreEmpresa: string; rubro: string; nombreUsuario: string }) => {
      const client = requireSupabase()
      const { error: rpcError } = await rpcRegistrarEmpresa(client, input)
      if (rpcError && !rpcError.message.includes('YA_TIENE_EMPRESA')) {
        return 'No se pudo crear la empresa'
      }
      limpiarAltaPendiente()
      const userId = session?.user.id
      if (userId) {
        const { data: perfilNuevo } = await client
          .from('usuarios')
          .select('id, empresa_id')
          .eq('id', userId)
          .maybeSingle()
        if (perfilNuevo) {
          await iniciarPeriodoPrueba(client, perfilNuevo.empresa_id, perfilNuevo.id)
          await registrarAceptacionTerminos(client, perfilNuevo.empresa_id, perfilNuevo.id)
        }
        await cargarPerfil(userId)
      }
      return null
    },
    [cargarPerfil, session],
  )

  const cerrarSesion = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setPerfil(null)
  }, [])

  const recargarPerfil = useCallback(async () => {
    if (session?.user.id) await cargarPerfil(session.user.id)
  }, [cargarPerfil, session])

  const recuperarPassword = useCallback(async (email: string) => {
    const client = requireSupabase()
    const { error: authError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (authError) return mensajeAuth(authError)
    return null
  }, [])

  const actualizarPassword = useCallback(async (password: string) => {
    const client = requireSupabase()
    const { error: authError } = await client.auth.updateUser({ password })
    if (authError) return mensajeAuth(authError)
    return null
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      listo,
      configurado: supabaseConfigured,
      session,
      perfil,
      error,
      ingresar,
      registrar,
      completarAlta,
      cerrarSesion,
      recargarPerfil,
      recuperarPassword,
      actualizarPassword,
    }),
    [
      listo,
      session,
      perfil,
      error,
      ingresar,
      registrar,
      completarAlta,
      cerrarSesion,
      recargarPerfil,
      recuperarPassword,
      actualizarPassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
