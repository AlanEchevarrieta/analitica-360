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
import { esErrorAuth } from './lib/consulta'
import { iniciarPeriodoPrueba, registrarAceptacionTerminos } from './lib/suscripcion'
import { leerAccesoColaborador } from './lib/permisos'
import { parseRol } from './lib/roles'
import { aceptarInvitacionColaborador } from './lib/usuarios'
import {
  guardarInvitacionPendiente,
  leerInvitacionPendiente,
  limpiarInvitacionPendiente,
} from './lib/invitacionPendiente'
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
    invitacion?: { empresaId: string }
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

function esRateLimitAuth(error: { message: string; status?: number } | null) {
  if (!error) return false
  if (error.status === 429) return true
  const msg = error.message.toLowerCase()
  return /rate limit|too many requests|over_request_rate_limit|429/.test(msg)
}

function mensajeAuth(error: { message: string; status?: number } | null): string {
  if (!error) return 'No se pudo completar la acción'
  if (esRateLimitAuth(error)) return 'Demasiados intentos, esperá unos segundos'
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
      .select('id, empresa_id, nombre, email, rol, activo, permisos')
      .eq('id', userId)
      .maybeSingle()

    if (qError) {
      if (esErrorAuth(qError)) return
      setError('No se pudo leer tu empresa. ¿Corriste el SQL en Supabase?')
      setPerfil(null)
      return
    }

    if (!data) {
      setPerfil(null)
      return
    }

    const empresaId = String(data.empresa_id ?? '')
    const { data: empresaRow, error: empError } = await client
      .from('empresas')
      .select('id, nombre, rubro, plan_actual, activo')
      .eq('id', empresaId)
      .maybeSingle()

    if (empError && !esErrorAuth(empError)) {
      setError('No se pudo leer tu empresa. ¿Corriste el SQL en Supabase?')
      setPerfil(null)
      return
    }

    const empresa = empresaRow as Empresa | null
    if (!empresa) {
      setPerfil(null)
      return
    }

    const rol = parseRol(data.rol)
    const acceso = await leerAccesoColaborador(client, data.id, rol)
    const usuario: Usuario = {
      id: data.id,
      empresa_id: data.empresa_id,
      nombre: data.nombre,
      email: data.email,
      rol,
      activo: data.activo,
      acceso,
    }
    setPerfil({ usuario, empresa })
    setError(null)
  }, [])

  const intentarUnirseEquipo = useCallback(async () => {
    const pendiente = leerInvitacionPendiente()
    if (!pendiente) return
    const client = requireSupabase()
    const { data: userData } = await client.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return
    const { data: existente } = await client.from('usuarios').select('id').eq('id', userId).maybeSingle()
    if (existente) {
      limpiarInvitacionPendiente()
      return
    }
    const fallo = await aceptarInvitacionColaborador(client, {
      empresaId: pendiente.empresaId,
      nombre: pendiente.nombreUsuario,
    })
    if (!fallo) limpiarInvitacionPendiente()
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
      await intentarUnirseEquipo()
      if (cancelado) return
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
  }, [cargarPerfil, intentarAltaPendiente, intentarUnirseEquipo])

  useEffect(() => {
    if (!supabase || !session?.user.id) return
    const client = supabase
    const usuarioId = session.user.id
    const canal = client
      .channel(`permisos-${usuarioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'colaborador_permisos', filter: `usuario_id=eq.${usuarioId}` },
        () => {
          void cargarPerfil(usuarioId)
        },
      )
      .subscribe()
    return () => {
      void client.removeChannel(canal)
    }
  }, [cargarPerfil, session?.user.id])

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
      invitacion?: { empresaId: string }
    }) => {
      const client = requireSupabase()
      if (input.invitacion) {
        guardarInvitacionPendiente({
          empresaId: input.invitacion.empresaId,
          nombreUsuario: input.nombreUsuario,
        })
      } else {
        guardarAltaPendiente({
          nombreEmpresa: input.nombreEmpresa,
          rubro: input.rubro,
          nombreUsuario: input.nombreUsuario,
        })
      }
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

      if (input.invitacion) {
        const fallo = await aceptarInvitacionColaborador(client, {
          empresaId: input.invitacion.empresaId,
          nombre: input.nombreUsuario,
        })
        if (fallo) return { error: fallo, esperaConfirmacion: false }
        limpiarInvitacionPendiente()
        if (data.user) await cargarPerfil(data.user.id)
        return { error: null, esperaConfirmacion: false }
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
      const invitacion = leerInvitacionPendiente()
      if (invitacion) {
        const fallo = await aceptarInvitacionColaborador(client, {
          empresaId: invitacion.empresaId,
          nombre: input.nombreUsuario || invitacion.nombreUsuario,
        })
        if (fallo) return fallo
        limpiarInvitacionPendiente()
        const userId = session?.user.id
        if (userId) await cargarPerfil(userId)
        return null
      }
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
    setSession(null)
    setPerfil(null)
    setError(null)
  }, [])

  const recargarPerfil = useCallback(async () => {
    if (session?.user.id) await cargarPerfil(session.user.id)
  }, [cargarPerfil, session])

  const recuperarPassword = useCallback(async (email: string) => {
    const client = requireSupabase()
    const { error: authError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://analitica360.app/reset-password',
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
