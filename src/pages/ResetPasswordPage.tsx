import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  evaluarPassword,
  nivelSeguridad,
  passwordValida,
  requisitosCumplidos,
} from '../lib/password'
import { AuthLayout, LockIcon, authInputWithIconClass } from './AuthLayout'

const REQUISITOS: { key: keyof ReturnType<typeof evaluarPassword>; label: string }[] = [
  { key: 'minLength', label: 'Mínimo 12 caracteres' },
  { key: 'upper', label: 'Al menos una mayúscula' },
  { key: 'lower', label: 'Al menos una minúscula' },
  { key: 'number', label: 'Al menos un número' },
  { key: 'special', label: 'Al menos un carácter especial (!@#$%^&*-_)' },
]

export function ResetPasswordPage() {
  const { listo, session, actualizarPassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const check = evaluarPassword(password)
  const listaOk = passwordValida(check)
  const nivel = nivelSeguridad(requisitosCumplidos(check))
  const coinciden = confirmacion.length > 0 && password === confirmacion
  const puedeGuardar = listaOk && coinciden

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!listaOk) {
      setError('La contraseña debe tener 12 caracteres, mayúscula, minúscula, número y un especial')
      return
    }
    setEnviando(true)
    const result = await actualizarPassword(password)
    setEnviando(false)
    if (result) setError(result)
    else navigate('/', { replace: true })
  }

  if (!listo) {
    return (
      <AuthLayout>
        <p className="flex flex-1 items-center justify-center text-sm text-[#4A5568]">Cargando…</p>
      </AuthLayout>
    )
  }

  if (!session) {
    return (
      <AuthLayout>
        <div className="flex flex-1 flex-col justify-center text-center">
          <h1 className="text-[22px] font-bold text-[#1A2F4A]">Analítica 360</h1>
          <p className="mt-4 text-sm text-[#4A5568]">
            El enlace no es válido o expiró. Pedí uno nuevo desde Ingresar.
          </p>
          <Link className="mt-6 text-sm font-medium text-[#6366F1]" to="/login">
            Volver a ingresar
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-center text-[22px] font-bold text-[#1A2F4A]">Analítica 360</h1>
        <p className="mt-2 mb-6 text-center text-sm text-[#4A5568]">Elegí tu contraseña nueva</p>
        <form className="flex flex-col" onSubmit={onSubmit}>
          <label className="text-left text-sm font-medium text-[#4A5568]">
            Contraseña nueva
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <LockIcon />
              </span>
              <input
                className={`${authInputWithIconClass} pr-10`}
                type={mostrarClave ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 px-1 text-xs font-medium text-[#94A3B8]"
                onClick={() => setMostrarClave((v) => !v)}
              >
                {mostrarClave ? 'Ocultar' : 'Ver'}
              </button>
            </span>
          </label>
          <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
            Confirmar contraseña
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <LockIcon />
              </span>
              <input
                className={authInputWithIconClass}
                type={mostrarClave ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmacion}
                onChange={(ev) => setConfirmacion(ev.target.value)}
              />
            </span>
          </label>
          {confirmacion.length > 0 ? (
            <p className={`mt-1.5 text-xs ${coinciden ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {coinciden ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
            </p>
          ) : null}

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: nivel.color }}>
                {nivel.etiqueta}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-1.5 rounded-full bg-[#E2E8F0]"
                  style={{
                    backgroundColor: n <= nivel.segmentos ? nivel.color : '#E2E8F0',
                  }}
                />
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            {REQUISITOS.map((item) => {
              const ok = check[item.key]
              return (
                <li key={item.key} className={`text-xs ${ok ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {ok ? '✓' : '✗'} {item.label}
                </li>
              )
            })}
          </ul>

          {error ? (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <button
            className="mt-6 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40"
            type="submit"
            disabled={enviando || !puedeGuardar}
          >
            {enviando ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
