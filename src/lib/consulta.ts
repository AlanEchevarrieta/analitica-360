export const MSG_SESION_EXPIRADA = 'Tu sesión expiró — iniciá sesión de nuevo'
export const MSG_ERROR_RED = 'No se pudieron cargar los datos — verificá tu conexión'

type AuthLike = { message?: string; status?: number; code?: string } | null | undefined

export function esErrorAuth(error: AuthLike | string | unknown) {
  if (!error) return false
  if (typeof error === 'string') {
    return /jwt/i.test(error) || /invalid (jwt|token)/i.test(error)
  }
  if (typeof error !== 'object') return false
  const e = error as { message?: string; status?: number; code?: string }
  if (e.status === 401) return true
  const msg = String(e.message ?? '')
  const code = String(e.code ?? '')
  return /jwt/i.test(msg) || /jwt/i.test(code) || code === 'PGRST301'
}

export function esErrorRed(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  if (msg === MSG_ERROR_RED) return true
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_internet|err_network|timeout|network error/i.test(
    msg,
  )
}

export function mensajeCargaTabla(error: AuthLike | string | null) {
  if (!error) return null
  if (esErrorAuth(error)) return null
  const msg = typeof error === 'string' ? error : String(error.message ?? '')
  if (esErrorRed(msg)) return MSG_ERROR_RED
  return msg
}

type ToastListener = (mensaje: string) => void
const toastListeners = new Set<ToastListener>()

export function suscribirToast(listener: ToastListener) {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}

export function mostrarToast(mensaje: string) {
  for (const listener of toastListeners) listener(mensaje)
}

let sesionExpiradaEnCurso = false

export function resetSesionExpiradaFlag() {
  sesionExpiradaEnCurso = false
}

export async function avisarSesionExpirada() {
  if (sesionExpiradaEnCurso) return
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (path === '/login' || path === '/registro' || path === '/reset-password') return

  sesionExpiradaEnCurso = true
  mostrarToast(MSG_SESION_EXPIRADA)

  window.setTimeout(() => {
    void (async () => {
      try {
        const { supabase } = await import('./supabase')
        await supabase?.auth.signOut()
      } catch {
        /* ignore */
      }
      try {
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
      window.location.assign('/login')
    })()
  }, 2000)
}

async function respuestaEsAuth(res: Response) {
  if (res.status === 401) return true
  if (res.ok) return false
  try {
    const body = (await res.clone().json()) as { message?: string; error_description?: string; msg?: string }
    const msg = String(body.message ?? body.error_description ?? body.msg ?? '')
    return esErrorAuth({ message: msg, status: res.status })
  } catch {
    return false
  }
}

function urlDe(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function pedir(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) return fetch(input.clone())
  return fetch(input, init)
}

export async function fetchSupabase(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = urlDe(input)
  const esAuthApi = url.includes('/auth/v1/')
  let ultimo: unknown

  for (let intento = 0; intento <= 2; intento++) {
    try {
      const res = await pedir(input, init)
      if (!esAuthApi && (await respuestaEsAuth(res))) {
        void avisarSesionExpirada()
      }
      return res
    } catch (error) {
      ultimo = error
      if (!esErrorRed(error) || intento === 2) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
    }
  }

  throw ultimo instanceof Error ? ultimo : new Error(MSG_ERROR_RED)
}
