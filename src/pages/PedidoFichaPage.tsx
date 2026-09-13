import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, PageSkeleton, PageTitle, btnPrimary, cardShell } from '../components/listado'
import { EscanerCodigoBarras, dispararPedidoCamara } from '../components/EscanerCodigoBarras'
import { mostrarToast } from '../lib/consulta'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  confirmarListoDespacho,
  estiloEstadoPedido,
  etiquetaEstadoPedido,
  etiquetaItemPedido,
  formatoFechaPedido,
  generarRemitoPdf,
  guardarAsignacionPedido,
  guardarItemPreparacion,
  itemPickingCompleto,
  itemsPorCodigoBarras,
  marcarConTransportista,
  marcarEntregado,
  marcarTodoPreparado,
  obtenerFichaPedido,
  redactarEmailDespacho,
  registrarDespacho,
  resumenPicking,
  sincronizarEstadoPicking,
  textoIncompletosPicking,
  TRANSPORTISTAS,
  urlSeguimiento,
  type PedidoFicha,
  type PedidoItemFicha,
} from '../lib/pedidos'
import { formatoARS } from '../lib/productos'
import { listarColaboradoresActivos } from '../lib/usuarios'
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

function vibrarPicking() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(50)
    }
  } catch {
    /* ignore */
  }
}

function normalizarPicking(lista: PedidoItemFicha[]) {
  return lista.map((i) => {
    const cantidadPreparada = Math.max(0, Math.min(i.cantidad, i.cantidadPreparada))
    return {
      ...i,
      cantidadPreparada,
      preparado: cantidadPreparada === i.cantidad && i.preparado,
    }
  })
}

function aplicarEscaneoItem(hit: PedidoItemFicha, lista: PedidoItemFicha[]) {
  const etiqueta = etiquetaItemPedido(hit)
  const actual = lista.find((x) => x.id === hit.id) ?? hit
  if (actual.cantidadPreparada >= actual.cantidad) {
    mostrarToast(
      `⚠️ Ya preparaste todas las unidades de [${etiqueta}] (${actual.cantidad}/${actual.cantidad})`,
      'warn',
    )
    return lista
  }
  const cantidadPreparada = actual.cantidadPreparada + 1
  const completo = cantidadPreparada === actual.cantidad
  const preparado = completo ? true : actual.preparado
  if (completo) {
    mostrarToast(`🎉 [${etiqueta}] completado! (${cantidadPreparada}/${actual.cantidad})`, 'ok')
  } else {
    mostrarToast(`✅ [${etiqueta}] escaneado (${cantidadPreparada}/${actual.cantidad})`, 'ok')
  }
  vibrarPicking()
  return lista.map((x) => (x.id === actual.id ? { ...x, cantidadPreparada, preparado } : x))
}

export function PedidoFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [ficha, setFicha] = useState<PedidoFicha | null>(null)
  const [items, setItems] = useState<PedidoItemFicha[]>([])
  const [colaboradores, setColaboradores] = useState<{ id: string; nombre: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [transportista, setTransportista] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  const [escaner, setEscaner] = useState(false)
  const [emailModal, setEmailModal] = useState<{ asunto: string; cuerpo: string } | null>(null)
  const [modalDespacho, setModalDespacho] = useState(false)
  const [variantesScan, setVariantesScan] = useState<PedidoItemFicha[] | null>(null)
  const [erroresCantidad, setErroresCantidad] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const estabaCompleto = useRef(false)

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
    const colab = await listarColaboradoresActivos(requireSupabase())
    if (!colab.error) {
      setColaboradores(colab.filas.map((u) => ({ id: u.id, nombre: u.nombre || u.email })))
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function persistirPicking(nextRaw: PedidoItemFicha[]) {
    if (!ficha) return
    const prev = items
    const next = normalizarPicking(nextRaw)
    setItems(next)
    setGuardando(true)
    for (const it of next) {
      const orig = prev.find((x) => x.id === it.id)
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
    setModalDespacho(true)
  }

  async function onCodigoDetectado(codigo: string) {
    if (!ficha) return
    const hits = itemsPorCodigoBarras(items, codigo)
    if (hits.length === 0) {
      mostrarToast(
        '❌ Este producto no pertenece al pedido — verificá que estás tomando el producto correcto',
        'error',
      )
      return
    }
    if (hits.length > 1) {
      setEscaner(false)
      setVariantesScan(hits)
      return
    }
    await persistirPicking(aplicarEscaneoItem(hits[0], items))
  }

  async function onConfirmarDespacho() {
    if (!ficha) return
    const faltan = textoIncompletosPicking(items)
    if (faltan) {
      setError(faltan)
      setModalDespacho(false)
      return
    }
    setGuardando(true)
    const fallo = await confirmarListoDespacho(requireSupabase(), ficha, items)
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    const next = items.map((i) => ({ ...i, preparado: true, cantidadPreparada: i.cantidad }))
    setItems(next)
    setFicha({ ...ficha, estado: 'listo_despacho', items: next })
    setModalDespacho(false)
    mostrarToast(`Pedido ${ficha.numeroPedido} · Listo para despacho`, 'ok')
  }

  function intentarMarcarListo() {
    const faltan = textoIncompletosPicking(items)
    if (faltan) {
      setError(faltan)
      return
    }
    setModalDespacho(true)
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

  const pickingBloqueado =
    ficha?.estado === 'despachado' ||
    ficha?.estado === 'con_transportista' ||
    ficha?.estado === 'entregado' ||
    ficha?.estado === 'cancelado'
  const picking = resumenPicking(items)
  const todosCantidades =
    items.length > 0 && items.every((i) => i.cantidadPreparada === i.cantidad)
  const pctItems = picking.itemsTot === 0 ? 0 : Math.round((picking.itemsListos / picking.itemsTot) * 100)
  const linkSeguimiento = urlSeguimiento(
    transportista || ficha?.transportista || ficha?.metodoEnvio || '',
    seguimiento || ficha?.numeroSeguimiento || '',
  )

  useEffect(() => {
    if (pickingBloqueado || !ficha || ficha.estado === 'listo_despacho') {
      estabaCompleto.current = todosCantidades
      return
    }
    if (todosCantidades && !estabaCompleto.current) {
      setModalDespacho(true)
    }
    estabaCompleto.current = todosCantidades
  }, [todosCantidades, pickingBloqueado, ficha])

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
          <p className="whitespace-pre-wrap rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {ficha ? (
          <>
            <PageTitle
              titulo={ficha.numeroPedido}
              subtitulo={`${ficha.clienteNombre || 'Sin cliente'} · ${formatoARS(ficha.total)} · ${formatoFechaPedido(ficha.createdAt)}`}
              accion={<BadgeEstado estado={ficha.estado} />}
            />
            <label className="mb-4 flex max-w-md flex-col text-sm text-[#94A3B8]">
              Asignado a
              <select
                className={`${inputDark} mt-1`}
                value={ficha.asignadoA ?? ''}
                disabled={guardando}
                onChange={(ev) => {
                  const val = ev.target.value || null
                  setFicha({ ...ficha, asignadoA: val })
                  void guardarAsignacionPedido(requireSupabase(), ficha.id, val).then((fallo) => {
                    if (fallo) setError(fallo)
                    else mostrarToast('Asignación actualizada', 'ok')
                  })
                }}
              >
                <option value="">Sin asignar</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="mb-4 whitespace-pre-wrap rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
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

              <div className="mt-4">
                <p className="text-sm font-medium text-[#E2E8F0]">
                  Preparados: {picking.itemsListos} de {picking.itemsTot} items
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#6366F1] transition-[width]"
                    style={{ width: `${pctItems}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {items.map((it) => {
                  const completo = itemPickingCompleto(it) && it.preparado
                  const enProgreso =
                    it.cantidadPreparada > 0 && (!it.preparado || it.cantidadPreparada < it.cantidad)
                  const pctUnidades = it.cantidad === 0 ? 0 : Math.min(100, (it.cantidadPreparada / it.cantidad) * 100)
                  const err = erroresCantidad[it.id]
                  const exacto = it.cantidadPreparada === it.cantidad
                  return (
                    <div
                      key={it.id}
                      className={`rounded-lg border p-3 ${enProgreso && !completo ? 'picking-en-progreso border-[#6366F1]' : 'border-[rgba(99,102,241,0.2)]'}`}
                      style={{
                        background: completo ? 'rgba(22, 163, 74, 0.14)' : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {completo ? (
                          <span className="text-3xl leading-none text-[#4ADE80]" aria-hidden>
                            ✓
                          </span>
                        ) : (
                          <span className="mt-1 h-7 w-7 shrink-0 rounded-full border border-white/20" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#F1F5F9]">{it.nombre}</p>
                          <p className="text-xs text-[#94A3B8]">
                            {[it.varianteEtiqueta, it.numeroLote ? `Lote ${it.numeroLote}` : '']
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                          <p className="mt-2 text-xs font-medium text-[#CBD5E1]">
                            {it.cantidadPreparada} / {it.cantidad} unidades
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[#6366F1]"
                              style={{ width: `${pctUnidades}%` }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap items-end gap-3">
                            <label className="text-xs text-[#94A3B8]">
                              Cantidad preparada
                              <input
                                className="mt-1 block h-10 w-24 rounded-md border border-[rgba(99,102,241,0.3)] bg-white/5 px-2 text-sm text-[#F1F5F9]"
                                inputMode="decimal"
                                disabled={pickingBloqueado || guardando}
                                value={drafts[it.id] ?? String(it.cantidadPreparada)}
                                onChange={(ev) => {
                                  const raw = ev.target.value
                                  setDrafts((d) => ({ ...d, [it.id]: raw }))
                                  if (raw === '' || raw === '-') return
                                  const n = Number(raw.replace(',', '.'))
                                  if (!Number.isFinite(n) || n < 0) {
                                    setErroresCantidad((e) => ({
                                      ...e,
                                      [it.id]: 'No se aceptan valores negativos',
                                    }))
                                    return
                                  }
                                  if (n > it.cantidad) {
                                    setErroresCantidad((e) => ({
                                      ...e,
                                      [it.id]: `Máximo: ${it.cantidad} unidades pedidas`,
                                    }))
                                    setDrafts((d) => ({ ...d, [it.id]: String(it.cantidadPreparada) }))
                                    return
                                  }
                                  setErroresCantidad((e) => {
                                    const nerr = { ...e }
                                    delete nerr[it.id]
                                    return nerr
                                  })
                                }}
                                onBlur={(ev) => {
                                  const n = Number(ev.target.value.replace(',', '.'))
                                  setDrafts((d) => {
                                    const nx = { ...d }
                                    delete nx[it.id]
                                    return nx
                                  })
                                  if (!Number.isFinite(n) || n < 0) {
                                    setErroresCantidad((e) => ({
                                      ...e,
                                      [it.id]: 'No se aceptan valores negativos',
                                    }))
                                    return
                                  }
                                  if (n > it.cantidad) {
                                    setErroresCantidad((e) => ({
                                      ...e,
                                      [it.id]: `Máximo: ${it.cantidad} unidades pedidas`,
                                    }))
                                    return
                                  }
                                  void persistirPicking(
                                    items.map((x) =>
                                      x.id === it.id
                                        ? {
                                            ...x,
                                            cantidadPreparada: n,
                                            preparado: n === x.cantidad ? x.preparado : false,
                                          }
                                        : x,
                                    ),
                                  )
                                }}
                              />
                            </label>
                            <label
                              className="inline-flex items-center gap-2 text-sm text-[#CBD5E1]"
                              onClick={() => {
                                if (pickingBloqueado) return
                                if (!exacto) {
                                  setErroresCantidad((e) => ({
                                    ...e,
                                    [it.id]: `Faltan ${it.cantidad - it.cantidadPreparada} unidades por preparar`,
                                  }))
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                disabled={pickingBloqueado || guardando || !exacto}
                                checked={it.preparado && exacto}
                                onChange={(ev) => {
                                  const on = ev.target.checked
                                  if (on && it.cantidadPreparada !== it.cantidad) {
                                    setErroresCantidad((e) => ({
                                      ...e,
                                      [it.id]: `Faltan ${it.cantidad - it.cantidadPreparada} unidades por preparar`,
                                    }))
                                    return
                                  }
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
                          </div>
                          {err ? <p className="mt-1 text-xs font-medium text-red-400">{err}</p> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="mt-4 text-sm text-[#CBD5E1]">
                Items preparados: {picking.itemsListos}/{picking.itemsTot} · Unidades: {picking.unidadesPrep}/
                {picking.unidadesTot}
              </p>

              {!pickingBloqueado && ficha.estado !== 'listo_despacho' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="h-11 rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC]"
                    type="button"
                    disabled={guardando || items.length === 0}
                    onClick={() => void onMarcarTodo()}
                  >
                    Marcar todo como preparado
                  </button>
                  <button
                    className={btnPrimary}
                    type="button"
                    disabled={guardando || items.length === 0}
                    onClick={intentarMarcarListo}
                  >
                    Continuar al despacho
                  </button>
                </div>
              ) : null}
              {ficha.estado === 'listo_despacho' ? (
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
        {modalDespacho && ficha ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
            <div className="w-full max-w-md rounded-lg bg-white p-5 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-bold">✅ Pedido {ficha.numeroPedido} completamente preparado</h3>
              <p className="mt-2 text-sm text-[#4A5568]">Todos los items fueron verificados</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={btnPrimary}
                  type="button"
                  disabled={guardando}
                  onClick={() => void onConfirmarDespacho()}
                >
                  Continuar al despacho
                </button>
                <button
                  className="h-11 rounded-lg border border-[#E2E8F0] px-4 text-sm font-semibold text-[#4A5568]"
                  type="button"
                  onClick={() => setModalDespacho(false)}
                >
                  Seguir revisando
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {variantesScan ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
            <div className="w-full max-w-md rounded-lg bg-white p-5 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-bold">¿Cuál variante escaneaste?</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {variantesScan.map((hit) => (
                  <button
                    key={hit.id}
                    className="rounded-full border border-[#E2E8F0] px-3 py-2 text-sm font-semibold text-[#1A2F4A] hover:border-[#6366F1] hover:text-[#4F46E5]"
                    type="button"
                    onClick={() => {
                      const elegido = hit
                      setVariantesScan(null)
                      void persistirPicking(aplicarEscaneoItem(elegido, items))
                    }}
                  >
                    [{hit.varianteEtiqueta || 'Sin variante'}]
                  </button>
                ))}
              </div>
              <button
                className="mt-4 text-sm font-medium text-[#4A5568]"
                type="button"
                onClick={() => setVariantesScan(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
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
