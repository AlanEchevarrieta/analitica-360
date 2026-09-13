import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, PageSkeleton, PageTitle, btnPrimary, cardShell } from '../components/listado'
import { EscanerCodigoBarras, dispararPedidoCamara } from '../components/EscanerCodigoBarras'
import { mostrarToast } from '../lib/consulta'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  estiloEstadoPedido,
  etiquetaEstadoPedido,
  formatoFechaPedido,
  generarRemitoPdf,
  guardarItemPreparacion,
  itemPorCodigoBarras,
  marcarConTransportista,
  marcarEntregado,
  marcarTodoPreparado,
  obtenerFichaPedido,
  redactarEmailDespacho,
  registrarDespacho,
  sincronizarEstadoPicking,
  TRANSPORTISTAS,
  urlSeguimiento,
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
  const [escaner, setEscaner] = useState(false)
  const [emailModal, setEmailModal] = useState<{ asunto: string; cuerpo: string } | null>(null)

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

  async function onCodigoDetectado(codigo: string) {
    if (!ficha) return
    const hit = itemPorCodigoBarras(items, codigo)
    if (!hit) {
      mostrarToast('❌ Producto no pertenece a este pedido', 'error')
      return
    }
    if (hit.preparado || hit.cantidadPreparada >= hit.cantidad) {
      mostrarToast(`⚠️ ${hit.nombre} ya completada (${hit.cantidad}/${hit.cantidad})`, 'warn')
      return
    }
    const cantidadPreparada = Math.min(hit.cantidad, hit.cantidadPreparada + 1)
    const preparado = cantidadPreparada >= hit.cantidad
    const next = items.map((x) => (x.id === hit.id ? { ...x, cantidadPreparada, preparado } : x))
    mostrarToast(`✅ ${hit.nombre} escaneada (${cantidadPreparada}/${hit.cantidad})`, 'ok')
    await persistirPicking(next)
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

  async function onTransportista() {
    if (!ficha || !perfil) return
    setGuardando(true)
    const fallo = await marcarConTransportista(requireSupabase(), ficha.id)
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    mostrarToast(`Pedido ${ficha.numeroPedido} · Con transportista`)
    const cfg = await obtenerConfiguracion(requireSupabase(), perfil.empresa.id)
    const actualizada: PedidoFicha = {
      ...ficha,
      items,
      estado: 'con_transportista',
      transportista: transportista || ficha.transportista,
      numeroSeguimiento: seguimiento || ficha.numeroSeguimiento,
    }
    setEmailModal(
      redactarEmailDespacho({
        ficha: actualizada,
        empresa: perfil.empresa.nombre,
        remitenteNombre: cfg.config.remitenteNombre,
        remitenteDireccion: cfg.config.remitenteDireccion,
      }),
    )
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
      const cfg = await obtenerConfiguracion(requireSupabase(), perfil.empresa.id)
      await generarRemitoPdf({
        empresa: perfil.empresa.nombre,
        ficha: { ...ficha, items },
        remitenteNombre: cfg.config.remitenteNombre,
        remitenteDireccion: cfg.config.remitenteDireccion,
        remitenteTelefono: cfg.config.remitenteTelefono,
        remitenteEmail: cfg.config.remitenteEmail,
      })
    } catch {
      setError('No se pudo generar el remito')
    }
  }

  if (!perfil) return null

  const pickingBloqueado =
    ficha?.estado === 'despachado' ||
    ficha?.estado === 'con_transportista' ||
    ficha?.estado === 'entregado' ||
    ficha?.estado === 'cancelado'
  const listo = items.length > 0 && items.every((i) => i.preparado)
  const linkSeguimiento = urlSeguimiento(
    transportista || ficha?.transportista || ficha?.metodoEnvio || '',
    seguimiento || ficha?.numeroSeguimiento || '',
  )

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <EscanerCodigoBarras
        activo={escaner}
        onDetected={onCodigoDetectado}
        onClose={() => setEscaner(false)}
      />
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#F1F5F9]">📦 Preparación del pedido</h2>
                {!pickingBloqueado ? (
                  <button
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[rgba(99,102,241,0.45)] px-3 text-sm font-semibold text-[#A5B4FC]"
                    type="button"
                    onClick={() => {
                      dispararPedidoCamara()
                      setEscaner(true)
                    }}
                  >
                    📷 Escanear item
                  </button>
                ) : null}
              </div>
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
                {linkSeguimiento ? (
                  <a
                    className="mt-2 inline-block text-sm font-semibold text-[#38BDF8] underline"
                    href={linkSeguimiento}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {linkSeguimiento}
                  </a>
                ) : null}
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

            {ficha.estado === 'despachado' || ficha.estado === 'con_transportista' || ficha.estado === 'entregado' ? (
              <section className="mb-6 p-4" style={cardShell}>
                <h2 className="text-base font-semibold text-[#F1F5F9]">Seguimiento</h2>
                <p className="mt-2 text-sm text-[#CBD5E1]">
                  {ficha.transportista || transportista || '—'} · {ficha.numeroSeguimiento || seguimiento || '—'}
                </p>
                {linkSeguimiento ? (
                  <a
                    className="mt-2 inline-block text-sm font-semibold text-[#38BDF8] underline"
                    href={linkSeguimiento}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver seguimiento
                  </a>
                ) : null}
              </section>
            ) : null}

            {ficha.estado === 'despachado' ? (
              <button
                className={`${btnPrimary} mb-3`}
                type="button"
                disabled={guardando}
                onClick={() => void onTransportista()}
              >
                Entregar a transportista
              </button>
            ) : null}

            {ficha.estado === 'con_transportista' ? (
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
        {emailModal ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-bold">Email al cliente</h3>
              <p className="mt-1 text-xs text-[#4A5568]">
                Todavía no se envía solo. Copiá el texto y pegalo en WhatsApp o email.
              </p>
              <p className="mt-3 text-sm font-semibold">Asunto</p>
              <p className="mt-1 rounded-md bg-[#EEF2F6] px-3 py-2 text-sm">{emailModal.asunto}</p>
              <p className="mt-3 text-sm font-semibold">Cuerpo</p>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[#EEF2F6] px-3 py-2 text-sm">
                {emailModal.cuerpo}
              </pre>
              <div className="mt-4 flex gap-2">
                <button
                  className={btnPrimary}
                  type="button"
                  onClick={() => {
                    const texto = `${emailModal.asunto}\n\n${emailModal.cuerpo}`
                    void navigator.clipboard.writeText(texto).then(
                      () => mostrarToast('Email copiado', 'ok'),
                      () => mostrarToast('No se pudo copiar', 'error'),
                    )
                  }}
                >
                  📋 Copiar email
                </button>
                <button
                  className="h-11 rounded-lg border border-[#E2E8F0] px-4 text-sm font-semibold text-[#4A5568]"
                  type="button"
                  onClick={() => setEmailModal(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
