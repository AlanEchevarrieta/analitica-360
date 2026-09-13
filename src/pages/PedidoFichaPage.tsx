import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, PageSkeleton, PageTitle, btnPrimary, cardShell } from '../components/listado'
import { mostrarToast } from '../lib/consulta'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  estiloEstadoPedido,
  etiquetaEstadoPedido,
  formatoFechaPedido,
  generarRemitoPdf,
  guardarItemPreparacion,
  marcarEntregado,
  marcarTodoPreparado,
  obtenerFichaPedido,
  registrarDespacho,
  sincronizarEstadoPicking,
  TRANSPORTISTAS,
  type PedidoFicha,
  type PedidoItemFicha,
} from '../lib/pedidos'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function BadgeEstado({ estado }: { estado: PedidoFicha['estado'] }) {
  const s = estiloEstadoPedido(estado)
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-[3px] text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {etiquetaEstadoPedido(estado)}
    </span>
  )
}

const inputDark =
  'mt-1.5 h-11 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9] outline-none focus:border-[#6366F1]'

export function PedidoFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [ficha, setFicha] = useState<PedidoFicha | null>(null)
  const [items, setItems] = useState<PedidoItemFicha[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [transportista, setTransportista] = useState('')
  const [seguimiento, setSeguimiento] = useState('')

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const res = await obtenerFichaPedido(requireSupabase(), id)
    setCargando(false)
    setFicha(res.ficha)
    setItems(res.ficha?.items ?? [])
    setTransportista(res.ficha?.transportista || res.ficha?.metodoEnvio || '')
    setSeguimiento(res.ficha?.numeroSeguimiento ?? '')
    setError(res.error)
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function persistirPicking(next: PedidoItemFicha[]) {
    if (!ficha) return
    setItems(next)
    setGuardando(true)
    for (const it of next) {
      const orig = ficha.items.find((x) => x.id === it.id)
      if (
        orig &&
        orig.preparado === it.preparado &&
        orig.cantidadPreparada === it.cantidadPreparada
      ) {
        continue
      }
      const fallo = await guardarItemPreparacion(requireSupabase(), {
        id: it.id,
        preparado: it.preparado,
        cantidadPreparada: it.cantidadPreparada,
      })
      if (fallo) {
        setError(fallo)
        setGuardando(false)
        return
      }
    }
    const sync = await sincronizarEstadoPicking(requireSupabase(), ficha, next)
    setGuardando(false)
    if (sync.error) {
      setError(sync.error)
      return
    }
    if (sync.estado !== ficha.estado) {
      mostrarToast(`Pedido ${ficha.numeroPedido} · ${etiquetaEstadoPedido(sync.estado)}`)
      setFicha({ ...ficha, estado: sync.estado, items: next })
    } else {
      setFicha({ ...ficha, items: next })
    }
  }

  async function onMarcarTodo() {
    if (!ficha) return
    setGuardando(true)
    const fallo = await marcarTodoPreparado(requireSupabase(), { ...ficha, items })
    if (fallo) {
      setGuardando(false)
      setError(fallo)
      return
    }
    const next = items.map((i) => ({ ...i, preparado: true, cantidadPreparada: i.cantidad }))
    const sync = await sincronizarEstadoPicking(requireSupabase(), ficha, next)
    setGuardando(false)
    if (sync.error) {
      setError(sync.error)
      return
    }
    setItems(next)
    setFicha({ ...ficha, estado: sync.estado, items: next })
    mostrarToast(`Pedido ${ficha.numeroPedido} · ${etiquetaEstadoPedido(sync.estado)}`)
  }

  async function onDespachar() {
    if (!ficha || !perfil) return
    setGuardando(true)
    const cfg = await obtenerConfiguracion(requireSupabase(), perfil.empresa.id)
    const fallo = await registrarDespacho(requireSupabase(), {
      ficha: { ...ficha, items },
      empresaId: perfil.empresa.id,
      usuarioId: perfil.usuario.id,
      transportista,
      numeroSeguimiento: seguimiento,
      ubicacionOrigen: cfg.config.ubicacionVentaDefault || null,
    })
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    mostrarToast(`Pedido ${ficha.numeroPedido} · Despachado`)
    await cargar()
  }

  async function onEntregar() {
    if (!ficha) return
    setGuardando(true)
    const fallo = await marcarEntregado(requireSupabase(), ficha.id)
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    mostrarToast(`Pedido ${ficha.numeroPedido} · Entregado`)
    await cargar()
  }

  async function onRemito() {
    if (!ficha || !perfil) return
    try {
      await generarRemitoPdf({ empresa: perfil.empresa.nombre, ficha: { ...ficha, items } })
    } catch {
      setError('No se pudo generar el remito')
    }
  }

  if (!perfil) return null

  const pickingBloqueado =
    ficha?.estado === 'despachado' || ficha?.estado === 'entregado' || ficha?.estado === 'cancelado'
  const listo = items.length > 0 && items.every((i) => i.preparado)

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Pedidos', to: '/pedidos' },
            { label: ficha?.numeroPedido ?? 'Pedido' },
          ]}
        />
        {cargando ? <PageSkeleton /> : null}
        {!cargando && error && !ficha ? (
          <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {ficha ? (
          <>
            <PageTitle
              titulo={ficha.numeroPedido}
              subtitulo={`${ficha.clienteNombre || 'Sin cliente'} · ${formatoARS(ficha.total)} · ${formatoFechaPedido(ficha.createdAt)}`}
              accion={<BadgeEstado estado={ficha.estado} />}
            />
            {error ? (
              <p className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
            ) : null}

            <div className="mb-4 flex flex-wrap gap-2">
              <button className={btnPrimary} type="button" onClick={() => void onRemito()}>
                📄 Generar remito
              </button>
            </div>

            <section className="mb-6 p-4" style={cardShell}>
              <h2 className="text-base font-semibold text-[#F1F5F9]">📦 Preparación del pedido</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
                      <th className="py-2 pr-3">Producto</th>
                      <th className="py-2 pr-3">Cantidad</th>
                      <th className="py-2 pr-3">Preparada</th>
                      <th className="py-2">Preparado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-t border-[rgba(99,102,241,0.15)]">
                        <td className="py-2.5 pr-3 text-[#F1F5F9]">
                          <p className="font-medium">{it.nombre}</p>
                          <p className="text-xs text-[#94A3B8]">
                            {[it.varianteEtiqueta, it.numeroLote ? `Lote ${it.numeroLote}` : '']
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 text-[#CBD5E1]">{it.cantidad}</td>
                        <td className="py-2.5 pr-3">
                          <input
                            className="h-10 w-20 rounded-md border border-[rgba(99,102,241,0.3)] bg-white/5 px-2 text-sm text-[#F1F5F9]"
                            inputMode="decimal"
                            disabled={pickingBloqueado || guardando}
                            defaultValue={it.cantidadPreparada}
                            key={`${it.id}-${it.cantidadPreparada}-${it.preparado}`}
                            onBlur={(ev) => {
                              const n = Number(ev.target.value.replace(',', '.'))
                              const cantidadPreparada = Number.isFinite(n) ? n : 0
                              void persistirPicking(
                                items.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        cantidadPreparada,
                                        preparado: cantidadPreparada >= x.cantidad,
                                      }
                                    : x,
                                ),
                              )
                            }}
                          />
                        </td>
                        <td className="py-2.5">
                          <label className="inline-flex items-center gap-2 text-sm text-[#CBD5E1]">
                            <input
                              type="checkbox"
                              disabled={pickingBloqueado || guardando}
                              checked={it.preparado}
                              onChange={(ev) => {
                                const on = ev.target.checked
                                void persistirPicking(
                                  items.map((x) =>
                                    x.id === it.id
                                      ? {
                                          ...x,
                                          preparado: on,
                                          cantidadPreparada: on ? x.cantidad : x.cantidadPreparada,
                                        }
                                      : x,
                                  ),
                                )
                              }}
                            />
                            ✓ Preparado
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!pickingBloqueado ? (
                <button
                  className="mt-4 h-11 rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC]"
                  type="button"
                  disabled={guardando || items.length === 0}
                  onClick={() => void onMarcarTodo()}
                >
                  Marcar todo como preparado
                </button>
              ) : null}
              {listo && ficha.estado === 'listo_despacho' ? (
                <p className="mt-4 rounded-lg bg-green-950/50 px-3 py-3 text-sm text-green-200">
                  ✅ Pedido listo para despachar
                </p>
              ) : null}
            </section>

            {ficha.estado === 'listo_despacho' ? (
              <section className="mb-6 p-4" style={cardShell}>
                <h2 className="text-base font-semibold text-[#F1F5F9]">Packing / Despacho</h2>
                <label className="mt-3 block text-sm text-[#94A3B8]">
                  Transportista
                  <select
                    className={inputDark}
                    value={transportista}
                    onChange={(ev) => setTransportista(ev.target.value)}
                  >
                    <option value="">Elegí transportista</option>
                    {TRANSPORTISTAS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block text-sm text-[#94A3B8]">
                  N° de seguimiento
                  <input
                    className={inputDark}
                    value={seguimiento}
                    onChange={(ev) => setSeguimiento(ev.target.value)}
                  />
                </label>
                <button
                  className={`${btnPrimary} mt-4`}
                  type="button"
                  disabled={guardando}
                  onClick={() => void onDespachar()}
                >
                  Registrar despacho
                </button>
              </section>
            ) : null}

            {ficha.estado === 'despachado' ? (
              <button
                className={btnPrimary}
                type="button"
                disabled={guardando}
                onClick={() => void onEntregar()}
              >
                Marcar como entregado
              </button>
            ) : null}

            <button
              className="mt-6 block text-sm font-medium text-[#A5B4FC]"
              type="button"
              onClick={() => navigate('/pedidos')}
            >
              Volver al listado
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
