import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, TableCard, Th, Tr, btnPrimary, theadClass, theadStyle } from '../components/listado'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  BADGE_ESTADO_OC,
  actualizarEstadoOc,
  formatoFechaOc,
  generarOcPdf,
  obtenerOrdenCompra,
  registrarRecepcionOc,
  type OrdenCompraFicha,
} from '../lib/ordenesCompra'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function BadgeEstado({ estado }: { estado: OrdenCompraFicha['estado'] }) {
  const b = BADGE_ESTADO_OC[estado]
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: b.bg, color: b.fg }}>
      {b.label}
    </span>
  )
}

export function OrdenCompraFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const [ficha, setFicha] = useState<OrdenCompraFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recepcion, setRecepcion] = useState(false)
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const { ficha: data, error: fallo } = await obtenerOrdenCompra(requireSupabase(), id)
    setCargando(false)
    if (fallo || !data) {
      setError(fallo || 'No se encontró la OC')
      return
    }
    setError(null)
    setFicha(data)
    setCantidades(
      Object.fromEntries(
        data.items.map((it) => [it.id, String(Math.max(0, it.cantidadPedida - it.cantidadRecibida))]),
      ),
    )
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function cambiarEstado(estado: OrdenCompraFicha['estado']) {
    if (!ficha) return
    setGuardando(true)
    const fallo = await actualizarEstadoOc(requireSupabase(), ficha.id, estado)
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    await cargar()
  }

  async function confirmarRecepcion() {
    if (!ficha) return
    setGuardando(true)
    const fallo = await registrarRecepcionOc(requireSupabase(), {
      ficha,
      cantidades: Object.fromEntries(Object.entries(cantidades).map(([k, v]) => [k, Number(v)])),
      proveedorNombre: ficha.proveedorNombre || 'Proveedor',
    })
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setRecepcion(false)
    await cargar()
  }

  async function pdf() {
    if (!ficha || !perfil) return
    const cfg = await obtenerConfiguracion(requireSupabase(), perfil.empresa.id)
    await generarOcPdf({
      empresa: cfg.config.remitenteNombre || perfil.empresa.nombre,
      direccion: cfg.config.remitenteDireccion,
      ficha,
    })
  }

  if (!perfil) return null

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Compras', to: '/compras' },
            { label: 'Órdenes de compra', to: '/compras?tab=oc' },
            { label: ficha?.numeroOc ?? 'OC' },
          ]}
        />
        {cargando ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {ficha ? (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[28px] font-semibold" style={{ color: 'var(--text)', fontFamily: theme.fontDisplay }}>
                  {ficha.numeroOc}
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {ficha.proveedorNombre || 'Sin proveedor'} · Emisión {formatoFechaOc(ficha.fechaEmision)} · Entrega{' '}
                  {formatoFechaOc(ficha.fechaEntregaEstimada)}
                </p>
                <div className="mt-2">
                  <BadgeEstado estado={ficha.estado} />
                </div>
              </div>
              <button className={btnPrimary} type="button" onClick={() => void pdf()}>
                📄 Generar OC
              </button>
            </div>

            <TableCard>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className={theadClass} style={theadStyle}>
                    <tr>
                      <Th>Producto</Th>
                      <Th>Variante</Th>
                      <Th>Cant pedida</Th>
                      <Th>Recibida</Th>
                      <Th>Precio unit</Th>
                      <Th>Subtotal</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.items.map((it, index) => (
                      <Tr key={it.id} index={index}>
                        <td className="px-3 py-3">{it.nombre}</td>
                        <td className="px-3 py-3">{it.varianteEtiqueta || '—'}</td>
                        <td className="px-3 py-3">{it.cantidadPedida}</td>
                        <td className="px-3 py-3">{it.cantidadRecibida}</td>
                        <td className="px-3 py-3">{formatoARS(it.precioUnitario)}</td>
                        <td className="px-3 py-3 font-semibold">{formatoARS(it.cantidadPedida * it.precioUnitario)}</td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-3 py-3 text-right font-bold text-[#6366F1]">Total {formatoARS(ficha.total)}</p>
            </TableCard>

            {ficha.notas ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                Notas: {ficha.notas}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {ficha.estado === 'borrador' ? (
                <>
                  <Link className={btnPrimary} to={`/compras/oc/${ficha.id}/editar`}>
                    ✏️ Editar OC
                  </Link>
                  <button
                    className="h-11 rounded-lg bg-[#3B82F6] px-4 text-sm font-semibold text-white"
                    type="button"
                    disabled={guardando}
                    onClick={() => void cambiarEstado('enviada')}
                  >
                    📤 Enviar al proveedor
                  </button>
                  <button
                    className="h-11 rounded-lg px-4 text-sm font-semibold text-[#F87171]"
                    type="button"
                    disabled={guardando}
                    onClick={() => void cambiarEstado('cancelada')}
                  >
                    ❌ Cancelar OC
                  </button>
                </>
              ) : null}
              {ficha.estado === 'enviada' || ficha.estado === 'confirmada' ? (
                <>
                  {ficha.estado === 'enviada' ? (
                    <button
                      className="h-11 rounded-lg bg-[#6366F1] px-4 text-sm font-semibold text-white"
                      type="button"
                      disabled={guardando}
                      onClick={() => void cambiarEstado('confirmada')}
                    >
                      ✅ Marcar como confirmada
                    </button>
                  ) : null}
                  <button className={btnPrimary} type="button" onClick={() => setRecepcion(true)}>
                    📦 Registrar recepción
                  </button>
                  <button
                    className="h-11 rounded-lg px-4 text-sm font-semibold text-[#F87171]"
                    type="button"
                    disabled={guardando}
                    onClick={() => void cambiarEstado('cancelada')}
                  >
                    ❌ Cancelar OC
                  </button>
                </>
              ) : null}
              {ficha.estado === 'recibida_parcial' ? (
                <button className={btnPrimary} type="button" onClick={() => setRecepcion(true)}>
                  📦 Registrar recepción adicional
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {recepcion && ficha ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5">
              <h2 className="text-lg font-bold text-[#1A2F4A]">Registrar recepción</h2>
              <table className="mt-3 w-full text-left text-sm text-[#1A2F4A]">
                <thead>
                  <tr>
                    <th className="py-2">Producto</th>
                    <th>Pedida</th>
                    <th>Ya recibida</th>
                    <th>Recibir ahora</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2">
                        {it.nombre}
                        {it.varianteEtiqueta ? ` (${it.varianteEtiqueta})` : ''}
                      </td>
                      <td>{it.cantidadPedida}</td>
                      <td>{it.cantidadRecibida}</td>
                      <td>
                        <input
                          className="h-9 w-20 rounded border px-2"
                          inputMode="numeric"
                          value={cantidades[it.id] ?? '0'}
                          onChange={(ev) => setCantidades((prev) => ({ ...prev, [it.id]: ev.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex gap-2">
                <button className="h-10 px-3 text-sm text-[#4A5568]" type="button" onClick={() => setRecepcion(false)}>
                  Cancelar
                </button>
                <button className={btnPrimary} type="button" disabled={guardando} onClick={() => void confirmarRecepcion()}>
                  Confirmar recepción
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <Link className="mt-8 block text-center text-sm text-[#A5B4FC]" to="/compras?tab=oc">
          Volver a órdenes
        </Link>
      </div>
    </div>
  )
}
