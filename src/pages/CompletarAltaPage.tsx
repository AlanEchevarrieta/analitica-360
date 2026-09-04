import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { AuthLayout, BuildingIcon, authInputClass, authInputWithIconClass } from './AuthLayout'

export function CompletarAltaPage() {
  const { completarAlta, cerrarSesion } = useAuth()
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [rubro, setRubro] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nombreEmpresa.trim()) {
      setError('El nombre de la empresa es obligatorio')
      return
    }
    setEnviando(true)
    const result = await completarAlta({
      nombreEmpresa: nombreEmpresa.trim(),
      rubro: rubro.trim(),
      nombreUsuario: nombreUsuario.trim(),
    })
    setEnviando(false)
    if (result) setError(result)
  }

  return (
    <AuthLayout>
      <h1 className="text-left text-[22px] font-bold leading-none text-[#1A2F4A]">Analítica 360</h1>
      <p className="mt-2 mb-8 text-left text-sm text-[#4A5568]">
        Tu usuario existe, pero falta el alta de empresa.
      </p>
      <form className="flex flex-col" onSubmit={onSubmit}>
        <label className="text-left text-sm font-medium text-[#4A5568]">
          Nombre de la empresa
          <span className="relative mt-1.5 block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <BuildingIcon />
            </span>
            <input
              className={authInputWithIconClass}
              value={nombreEmpresa}
              onChange={(ev) => setNombreEmpresa(ev.target.value)}
            />
          </span>
        </label>
        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Rubro
          <input
            className={`${authInputClass} mt-1.5`}
            value={rubro}
            onChange={(ev) => setRubro(ev.target.value)}
          />
        </label>
        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Tu nombre
          <input
            className={`${authInputClass} mt-1.5`}
            value={nombreUsuario}
            onChange={(ev) => setNombreUsuario(ev.target.value)}
          />
        </label>
        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          className="mt-6 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold tracking-wide text-white transition hover:bg-[#4F46E5] disabled:opacity-50"
          type="submit"
          disabled={enviando}
        >
          {enviando ? 'GUARDANDO…' : 'CREAR EMPRESA'}
        </button>
      </form>
      <button
        className="mt-6 text-sm font-medium text-[#6366F1] hover:text-[#4F46E5]"
        type="button"
        onClick={() => void cerrarSesion()}
      >
        Cerrar sesión
      </button>
    </AuthLayout>
  )
}
