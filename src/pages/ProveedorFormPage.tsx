import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { linkWhatsApp } from '../lib/clientes'
import {
  CONDICIONES_AFIP,
  CONDICIONES_PAGO,
  FORMAS_PAGO_ACEPTADAS,
  actualizarProveedor,
  crearProveedor,
  formatCbu,
  formatCuit,
  obtenerProveedor,
  type ProveedorFila,
  type ProveedorInput,
} from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

const inputClass =
  'mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

const seccion = 'mt-6 text-xs font-semibold uppercase tracking-wide text-[#6366F1]'

function vacio(): ProveedorInput {
  return {
    razonSocial: '',
    nombreComercial: '',
    cuit: '',
    condicionAfip: '',
    telefono: '',
    email: '',
    nombreVendedor: '',
    productosQueProvee: '',
    condicionesPago: '',
    formasPagoAceptadas: [],
    plazoEntrega: '',
    cbu: '',
    aliasCbu: '',
    banco: '',
    notas: '',
    activo: true,
  }
}

function desdeFila(fila: ProveedorFila): ProveedorInput {
  return {
    razonSocial: fila.razon_social ?? fila.nombre,
    nombreComercial: fila.nombre_comercial ?? '',
    cuit: fila.cuit ?? '',
    condicionAfip: fila.condicion_afip ?? '',
    telefono: fila.telefono ?? '',
    email: fila.email ?? '',
    nombreVendedor: fila.nombre_vendedor ?? '',
    productosQueProvee: fila.productos_que_provee ?? '',
    condicionesPago: fila.condiciones_pago ?? '',
    formasPagoAceptadas: fila.formas_pago_aceptadas,
    plazoEntrega: fila.plazo_entrega ?? '',
    cbu: fila.cbu ?? '',
    aliasCbu: fila.alias_cbu ?? '',
    banco: fila.banco ?? '',
    notas: fila.notas ?? '',
    activo: fila.activo,
  }
}

export function ProveedorFormPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const esNuevo = !id
  const [form, setForm] = useState<ProveedorInput>(vacio)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(!esNuevo)

  useEffect(() => {
    if (esNuevo || !id) return
    void (async () => {
      const { fila, error: fallo } = await obtenerProveedor(requireSupabase(), id)
      setCargando(false)
      if (fallo || !fila) {
        setError(fallo || 'No se encontró el proveedor')
        return
      }
      setForm(desdeFila(fila))
    })()
  }, [esNuevo, id])

  function set<K extends keyof ProveedorInput>(clave: K, valor: ProveedorInput[K]) {
    setForm((prev) => ({ ...prev, [clave]: valor }))
  }

  function toggleForma(forma: string) {
    setForm((prev) => ({
      ...prev,
      formasPagoAceptadas: prev.formasPagoAceptadas.includes(forma)
        ? prev.formasPagoAceptadas.filter((f) => f !== forma)
        : [...prev.formasPagoAceptadas, forma],
    }))
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    if (!form.razonSocial.trim()) {
      setError('La razón social es obligatoria')
      return
    }
    setEnviando(true)
    if (esNuevo) {
      const { id: nuevoId, error: fallo } = await crearProveedor(requireSupabase(), form)
      setEnviando(false)
      if (fallo || !nuevoId) {
        setError(fallo || 'No se pudo crear el proveedor')
        return
      }
      navigate(`/proveedores/${nuevoId}`, { replace: true })
      return
    }
    const fallo = await actualizarProveedor(requireSupabase(), id as string, form)
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    navigate(`/proveedores/${id}`, { replace: true })
  }

  if (!perfil) return null
  if (perfil.usuario.rol === 'visor') {
    return <Navigate to="/proveedores" replace />
  }

  const wa = linkWhatsApp(form.telefono)

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-[440px] px-4 py-8">
        <AppNav />
        <form
          className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
          onSubmit={(e) => void onSubmit(e)}
        >
          <h1 className="text-xl font-bold text-[#1A2F4A]">
            {esNuevo ? 'Nuevo proveedor' : 'Editar proveedor'}
          </h1>
          {cargando ? (
            <p className="mt-5 text-sm text-[#4A5568]">Cargando…</p>
          ) : (
            <>
              <p className={seccion}>Datos fiscales</p>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Razón social
                <input
                  className={inputClass}
                  value={form.razonSocial}
                  onChange={(ev) => set('razonSocial', ev.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Nombre comercial
                <input
                  className={inputClass}
                  value={form.nombreComercial}
                  onChange={(ev) => set('nombreComercial', ev.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                CUIT
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="XX-XXXXXXXX-X"
                  value={form.cuit}
                  onChange={(ev) => set('cuit', formatCuit(ev.target.value))}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Condición AFIP
                <select
                  className={inputClass}
                  value={form.condicionAfip}
                  onChange={(ev) => set('condicionAfip', ev.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {CONDICIONES_AFIP.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </label>

              <p className={seccion}>Datos de contacto</p>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Teléfono / WhatsApp
                <input
                  className={inputClass}
                  value={form.telefono}
                  onChange={(ev) => set('telefono', ev.target.value)}
                />
              </label>
              {wa ? (
                <a
                  className="mt-1.5 inline-block text-sm font-medium text-[#6366F1] hover:underline"
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir WhatsApp
                </a>
              ) : null}
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Email
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(ev) => set('email', ev.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Nombre del vendedor / contacto
                <input
                  className={inputClass}
                  value={form.nombreVendedor}
                  onChange={(ev) => set('nombreVendedor', ev.target.value)}
                />
              </label>

              <p className={seccion}>Datos comerciales</p>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Productos que provee
                <input
                  className={inputClass}
                  value={form.productosQueProvee}
                  onChange={(ev) => set('productosQueProvee', ev.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Condiciones de pago
                <select
                  className={inputClass}
                  value={form.condicionesPago}
                  onChange={(ev) => set('condicionesPago', ev.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {CONDICIONES_PAGO.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-4 text-sm font-medium text-[#4A5568]">Forma de pago aceptada</p>
              <div className="mt-2 space-y-2">
                {FORMAS_PAGO_ACEPTADAS.map((forma) => (
                  <label key={forma} className="flex items-center gap-2 text-sm text-[#1A2F4A]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#6366F1]"
                      checked={form.formasPagoAceptadas.includes(forma)}
                      onChange={() => toggleForma(forma)}
                    />
                    {forma}
                  </label>
                ))}
              </div>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Plazo de entrega habitual
                <input
                  className={inputClass}
                  value={form.plazoEntrega}
                  onChange={(ev) => set('plazoEntrega', ev.target.value)}
                />
              </label>

              <p className={seccion}>Datos bancarios</p>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                CBU
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.cbu}
                  onChange={(ev) => set('cbu', formatCbu(ev.target.value))}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Alias CBU
                <input
                  className={inputClass}
                  value={form.aliasCbu}
                  onChange={(ev) => set('aliasCbu', ev.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Banco
                <input
                  className={inputClass}
                  value={form.banco}
                  onChange={(ev) => set('banco', ev.target.value)}
                />
              </label>

              <p className={seccion}>Otros</p>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Notas
                <textarea
                  className="mt-1.5 min-h-[88px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
                  value={form.notas}
                  onChange={(ev) => set('notas', ev.target.value)}
                />
              </label>
              <label className="mt-4 flex items-center gap-3 text-sm font-medium text-[#4A5568]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#6366F1]"
                  checked={form.activo}
                  onChange={(ev) => set('activo', ev.target.checked)}
                />
                Activo
              </label>
              {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              <button
                className="mt-6 h-11 w-full rounded-lg bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                type="submit"
                disabled={enviando}
              >
                {enviando ? 'GUARDANDO…' : esNuevo ? 'Crear proveedor' : 'Guardar cambios'}
              </button>
              <Link
                className="mt-4 block text-center text-sm font-medium text-[#6366F1]"
                to={id ? `/proveedores/${id}` : '/proveedores'}
              >
                Cancelar
              </Link>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
