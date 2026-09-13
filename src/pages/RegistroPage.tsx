import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  evaluarPassword,
  nivelSeguridad,
  passwordValida,
  requisitosCumplidos,
} from '../lib/password'
import {
  AuthLayout,
  BuildingIcon,
  LockIcon,
  UserIcon,
  authInputClass,
  authInputWithIconClass,
} from './AuthLayout'

const REQUISITOS: { key: keyof ReturnType<typeof evaluarPassword>; label: string }[] = [
  { key: 'minLength', label: 'Mínimo 12 caracteres' },
  { key: 'upper', label: 'Al menos una mayúscula' },
  { key: 'lower', label: 'Al menos una minúscula' },
  { key: 'number', label: 'Al menos un número' },
  { key: 'special', label: 'Al menos un carácter especial (!@#$%^&*-_)' },
]

export function RegistroPage() {
  const { registrar } = useAuth()
  const [searchParams] = useSearchParams()
  const empresaInv = searchParams.get('empresa') ?? ''
  const rolInvRaw = searchParams.get('rol') === 'administrador' ? 'administrador' : 'operario'
  const esInvitacion = Boolean(empresaInv)
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [rubro, setRubro] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [bloqueo, setBloqueo] = useState(false)

  const check = evaluarPassword(password)
  const listaOk = passwordValida(check)
  const nivel = nivelSeguridad(requisitosCumplidos(check))
  const coinciden = confirmacion.length > 0 && password === confirmacion
  const puedeCrear = listaOk && coinciden

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando || bloqueo) return
    setError(null)
    setAviso(null)
    if (!esInvitacion && !nombreEmpresa.trim()) {
      setError('El nombre de la empresa es obligatorio')
      return
    }
    if (!email.includes('@')) {
      setError('Ingresá un email válido')
      return
    }
    if (!listaOk) {
      setError('La contraseña no cumple todos los requisitos de seguridad')
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!aceptaTerminos) {
      setError('Tenés que aceptar los Términos y Condiciones')
      return
    }
    setEnviando(true)
    setBloqueo(true)
    window.setTimeout(() => setBloqueo(false), 3000)
    const result = await registrar({
      email: email.trim(),
      password,
      nombreEmpresa: esInvitacion ? 'Equipo' : nombreEmpresa.trim(),
      rubro: rubro.trim(),
      nombreUsuario: nombreUsuario.trim(),
      invitacion: esInvitacion
        ? { empresaId: empresaInv, rol: rolInvRaw }
        : undefined,
    })
    setEnviando(false)
    if (result.error) setError(result.error)
    else if (result.esperaConfirmacion) {
      setAviso('Revisá tu email para confirmar la cuenta. Después volvé a ingresar.')
    }
  }

  return (
    <AuthLayout tabs>
      <h1 className="text-center text-[22px] font-bold leading-none text-[#1A2F4A]">Analítica 360</h1>
      {esInvitacion ? (
        <p className="mt-4 rounded-lg bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A]">
          Te invitaron a unirte al equipo como {rolInvRaw === 'administrador' ? 'Administrador' : 'Operario'}.
        </p>
      ) : null}
      <form className="mt-6 flex flex-col" onSubmit={onSubmit}>
        {esInvitacion ? null : (
          <>
        <label className="text-left text-sm font-medium text-[#4A5568]">
          Nombre de la empresa
          <span className="relative mt-1.5 block">
            <span className="input-icon">
              <BuildingIcon />
            </span>
            <input
              className={authInputWithIconClass}
              value={nombreEmpresa}
              onChange={(ev) => setNombreEmpresa(ev.target.value)}
              placeholder="Acacia Mates"
            />
          </span>
        </label>

        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Rubro
          <select
            className={`${authInputClass} mt-1.5`}
            value={rubro}
            onChange={(ev) => setRubro(ev.target.value)}
          >
            <option value="">Seleccioná tu rubro (opcional)</option>
            <optgroup label="Comercio">
              <option value="Indumentaria y calzado">Indumentaria y calzado</option>
              <option value="Ferretería y materiales">Ferretería y materiales</option>
              <option value="Librería y papelería">Librería y papelería</option>
              <option value="Electrónica y tecnología">Electrónica y tecnología</option>
              <option value="Farmacia y perfumería">Farmacia y perfumería</option>
              <option value="Supermercado y almacén">Supermercado y almacén</option>
              <option value="Muebles y decoración">Muebles y decoración</option>
              <option value="Juguetería">Juguetería</option>
            </optgroup>
            <optgroup label="Gastronomía">
              <option value="Restaurant y parrilla">Restaurant y parrilla</option>
              <option value="Cafetería y confitería">Cafetería y confitería</option>
              <option value="Panadería y pastelería">Panadería y pastelería</option>
              <option value="Delivery y comida rápida">Delivery y comida rápida</option>
            </optgroup>
            <optgroup label="Salud y Bienestar">
              <option value="Veterinaria">Veterinaria</option>
              <option value="Peluquería y estética">Peluquería y estética</option>
              <option value="Gimnasio y deporte">Gimnasio y deporte</option>
              <option value="Óptica">Óptica</option>
            </optgroup>
            <optgroup label="Servicios Profesionales">
              <option value="Estudio contable">Estudio contable</option>
              <option value="Inmobiliaria">Inmobiliaria</option>
              <option value="Estudio jurídico">Estudio jurídico</option>
              <option value="Consultoría">Consultoría</option>
            </optgroup>
            <optgroup label="Automotriz">
              <option value="Taller mecánico">Taller mecánico</option>
              <option value="Lavadero de autos">Lavadero de autos</option>
              <option value="Venta de repuestos">Venta de repuestos</option>
              <option value="Concesionaria">Concesionaria</option>
            </optgroup>
            <optgroup label="Producción y Artesanía">
              <option value="Productos artesanales">Productos artesanales</option>
              <option value="Vivero y plantas">Vivero y plantas</option>
              <option value="Joyería y bijouterie">Joyería y bijouterie</option>
              <option value="Textil y confección">Textil y confección</option>
            </optgroup>
            <option value="Otro">Otro</option>
          </select>
        </label>
          </>
        )}

        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Tu nombre
          <input
            className={`${authInputClass} mt-1.5`}
            value={nombreUsuario}
            onChange={(ev) => setNombreUsuario(ev.target.value)}
            placeholder="Ej: Juan, María, Belén..."
          />
        </label>

        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Email
          <span className="relative mt-1.5 block">
            <span className="input-icon">
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

        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Contraseña
          <span className="relative mt-1.5 block">
            <span className="input-icon">
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
              className="absolute inset-y-0 right-2 px-1 text-xs font-medium text-[#94A3B8] hover:text-[#4A5568]"
              onClick={() => setMostrarClave((v) => !v)}
            >
              {mostrarClave ? 'Ocultar' : 'Ver'}
            </button>
          </span>
        </label>

        <label className="mt-4 text-left text-sm font-medium text-[#4A5568]">
          Repetir contraseña
          <span className="relative mt-1.5 block">
            <span className="input-icon">
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
              <li
                key={item.key}
                className={`text-xs ${ok ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}
              >
                {ok ? '✓' : '✗'} {item.label}
              </li>
            )
          })}
        </ul>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {aviso ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>
        ) : null}

        <div className="mt-5 flex items-start gap-3">
          <input
            id="terminos"
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#6366F1]"
            checked={aceptaTerminos}
            onChange={(ev) => setAceptaTerminos(ev.target.checked)}
          />
          <label htmlFor="terminos" className="text-sm leading-snug text-[#4A5568]">
            Acepto los{' '}
            <a
              href="/terminos"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#6366F1] underline hover:text-[#4F46E5]"
              onClick={(ev) => ev.stopPropagation()}
            >
              Términos y Condiciones
            </a>{' '}
            y la{' '}
            <a
              href="/privacidad"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#6366F1] underline hover:text-[#4F46E5]"
              onClick={(ev) => ev.stopPropagation()}
            >
              Política de Privacidad
            </a>
          </label>
        </div>

        <button
          className="mt-6 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold tracking-wide text-white transition hover:bg-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40"
          type="submit"
          disabled={enviando || bloqueo || !puedeCrear || !aceptaTerminos}
        >
          {enviando ? 'CREANDO…' : 'CREAR EMPRESA'}
        </button>
      </form>
    </AuthLayout>
  )
}
