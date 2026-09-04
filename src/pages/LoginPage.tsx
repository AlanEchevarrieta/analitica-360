import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  AuthLayout,
  LockIcon,
  UserIcon,
  authInputClass,
  authInputWithIconClass,
} from './AuthLayout'

export function LoginPage() {
  const { ingresar, recuperarPassword } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pedirEmail, setPedirEmail] = useState(false)
  const [emailRecupero, setEmailRecupero] = useState('')
  const [enviandoRecupero, setEnviandoRecupero] = useState(false)

  useEffect(() => {
    const desc = params.get('error_description') || params.get('error')
    if (desc) {
      setError(
        desc.includes('redirect') || desc.includes('127.0.0.1') || desc.includes('localhost')
          ? 'El mail apunta a esta notebook. Tiene que estar prendida, con Analítica 360 abierta, y el link hay que abrirlo acá (no en el celular).'
          : desc.replace(/\+/g, ' '),
      )
    }
  }, [params])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!email.includes('@')) {
      setError('Ingresá un email válido')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setEnviando(true)
    const result = await ingresar(email.trim(), password)
    setEnviando(false)
    if (result) setError(result)
  }

  async function enviarRecupero(mail: string) {
    if (!mail.includes('@')) {
      setError('Ingresá un email válido')
      return
    }
    setError(null)
    setAviso(null)
    setEnviandoRecupero(true)
    const result = await recuperarPassword(mail.trim())
    setEnviandoRecupero(false)
    if (result) setError(result)
    else {
      setAviso(
        'Te enviamos un email. Abrilo en esta misma computadora, con Analítica 360 abierta. Si la notebook está apagada o lo abrís en el celular, va a fallar.',
      )
      setPedirEmail(false)
    }
  }

  async function onOlvido() {
    const mail = email.trim()
    if (mail.includes('@')) {
      await enviarRecupero(mail)
      return
    }
    setPedirEmail(true)
    setAviso(null)
    setError(null)
  }

  return (
    <AuthLayout tabs>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-center text-[22px] font-bold leading-none text-[#1A2F4A]">
          Analítica 360
        </h1>
        <p className="mt-2 mb-6 text-center text-sm text-[#4A5568]">Ingresá a tu empresa</p>
        <form className="flex flex-col" onSubmit={onSubmit}>
          <label className="text-left text-sm font-medium text-[#4A5568]">
            Email
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <UserIcon />
              </span>
              <input
                className={authInputWithIconClass}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </span>
          </label>

          <label className="mt-5 text-left text-sm font-medium text-[#4A5568]">
            Contraseña
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <LockIcon />
              </span>
              <input
                className={`${authInputWithIconClass} pr-10`}
                type={mostrarClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 px-1 text-xs font-medium text-[#94A3B8] hover:text-[#4A5568]"
                onClick={() => setMostrarClave((v) => !v)}
              >
                {mostrarClave ? 'Ocultar' : 'Ver'}
              </button>
            </span>
          </label>

          {error ? (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {aviso ? (
            <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</p>
          ) : null}

          <button
            className="mt-6 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold tracking-wide text-white transition hover:bg-[#4F46E5] disabled:opacity-50"
            type="submit"
            disabled={enviando}
          >
            {enviando ? 'INGRESANDO…' : 'INGRESAR'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-center text-sm text-[#6366F1] hover:text-[#4F46E5]"
          onClick={() => void onOlvido()}
          disabled={enviandoRecupero}
        >
          {enviandoRecupero ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
        </button>

        {pedirEmail ? (
          <div className="mt-3">
            <input
              className={authInputClass}
              type="email"
              placeholder="Tu email"
              value={emailRecupero}
              onChange={(ev) => setEmailRecupero(ev.target.value)}
            />
            <button
              type="button"
              className="mt-2 w-full text-center text-sm font-medium text-[#6366F1]"
              onClick={() => void enviarRecupero(emailRecupero)}
              disabled={enviandoRecupero}
            >
              Enviar enlace
            </button>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  )
}
