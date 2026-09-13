import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { AjustarStockModal } from '../components/AjustarStockModal'
import { HistorialMovimientosPanel } from '../components/HistorialMovimientosPanel'
import { InventarioLotesTab } from '../components/InventarioLotesTab'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  FilterCollapse,
  ListCard,
  MobileCards,
  PageTitle,
  PageSkeleton,
  TableCard,
  TableErrorRed,
  Th,
  Tr,
  theadClass,
  theadStyle,
} from '../components/listado'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import {
  estadoStock,
  etiquetaEstadoStock,
  formatoFechaMov,
  listarResumenInventario,
  listarUbicaciones,
  leerUmbralStock,
  registrarTraslado,
  type ResumenInventario,
  type EstadoStock,
  type UbicacionFila,
} from '../lib/inventario'
import { esCasaStand, stockDe, stockPorUbicaciones } from '../lib/ubicaciones'
import { listarProductosNombres } from '../lib/productos'
import { obtenerConfiguracion } from '../lib/configuracion'
import { etiquetaCombo, listarVariantesDeProductos, stockPorVariante, sumaStockItems } from '../lib/variantes'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function fechaCorta(iso: string | null) {
  if (!iso) return '—'
  return formatoFechaMov(iso).split(',')[0] ?? formatoFechaMov(iso)
}

type TabInv = 'stock' | 'lotes' | 'movimientos'
type FiltroEstadoLote = 'todos' | 'vigente' | 'por_vencer' | 'vencido'

function parseTab(raw: string | null, usaLotes: boolean): TabInv {
  if (raw === 'movimientos') return 'movimientos'
  if (raw === 'lotes' && usaLotes) return 'lotes'
  return 'stock'
}

function parseEstadoLote(raw: string | null): FiltroEstadoLote {
  if (raw === 'vigente' || raw === 'por_vencer' || raw === 'vencido') return raw
  return 'todos'
}

export function InventarioPage() {
  const { perfil } = useAuth()
  const [params, setParams] = useSearchParams()
  const [usaLotes, setUsaLotes] = useState(false)
  const [filas, setFilas] = useState<ResumenInventario[]>([])
  const [ubicaciones, setUbicaciones] = useState<UbicacionFila[]>([])
  const [umbral, setUmbral] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | EstadoStock>('todos')
  const [categoria, setCategoria] = useState('')
  const [historial, setHistorial] = useState<ResumenInventario | null>(null)
  const [ajuste, setAjuste] = useState<ResumenInventario | null>(null)
  const [traslado, setTraslado] = useState(false)
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [desglose, setDesglose] = useState<Map<string, { etiqueta: string; stock: number }[]>>(
    new Map(),
  )
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const [stockUbic, setStockUbic] = useState<Map<string, Map<string, number>>>(new Map())

  const cargar = useCallback(async () => {
    if (!perfil) return
    setCargando(true)
    const client = requireSupabase()
    const [res, ub, umb] = await Promise.all([
      listarResumenInventario(client),
      listarUbicaciones(client),
      leerUmbralStock(client, perfil.empresa.id),
    ])
    setCargando(false)
    setUmbral(umb)
    setUbicaciones(ub.filas)
    if (res.error) {
      const msg = mensajeCargaTabla(res.error)
      setError(msg === MSG_ERROR_RED ? MSG_ERROR_RED : res.error)
      return
    }
    setError(null)
    setFilas(res.filas)
    const layoutDinamico =
      ub.filas.length > 2 || (ub.filas.length >= 2 && !esCasaStand(ub.filas))
    if (layoutDinamico && res.filas.length > 0) {
      setStockUbic(await stockPorUbicaciones(client, res.filas.map((f) => f.id)))
    } else {
      setStockUbic(new Map())
    }
    const { config } = await obtenerConfiguracion(client, perfil.empresa.id)
    setUsaLotes(Boolean(config.usaLotes))
    if (config.usaVariantes && res.filas.length > 0) {
      const vars = await listarVariantesDeProductos(
        client,
        res.filas.map((f) => f.id),
      )
      if (!vars.error && vars.filas.length > 0) {
        const stocks = await stockPorVariante(
          client,
          vars.filas.map((v) => v.id),
        )
        const map = new Map<string, { etiqueta: string; stock: number }[]>()
        for (const v of vars.filas.filter((x) => x.activo)) {
          const arr = map.get(v.productoId) ?? []
          arr.push({ etiqueta: etiquetaCombo(v.atributos), stock: stocks.get(v.id) ?? 0 })
          map.set(v.productoId, arr)
        }
        setDesglose(map)
        setFilas(
          res.filas.map((f) => {
            const items = map.get(f.id)
            if (!items?.length) return f
            return { ...f, stock_actual: sumaStockItems(items) }
          }),
        )
      } else {
        setDesglose(new Map())
      }
    } else {
      setDesglose(new Map())
    }
  }, [perfil])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const categorias = useMemo(
    () =>
      [...new Set(filas.map((f) => (f.categoria ?? '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [filas],
  )

  const visibles = useMemo(() => {
    return filas.filter((f) => {
      if (categoria && (f.categoria ?? '') !== categoria) return false
      if (estadoFiltro !== 'todos' && estadoStock(f.stock_actual, umbral) !== estadoFiltro) return false
      return true
    })
  }, [filas, categoria, estadoFiltro, umbral])

  const tab = parseTab(params.get('tab'), usaLotes)
  const estadoLoteParam = parseEstadoLote(params.get('estado'))

  function irTab(next: TabInv, estado?: FiltroEstadoLote) {
    const nextParams = new URLSearchParams(params)
    if (next === 'stock') nextParams.delete('tab')
    else nextParams.set('tab', next)
    if (next === 'lotes') {
      if (!estado || estado === 'todos') nextParams.delete('estado')
      else nextParams.set('estado', estado)
    } else {
      nextParams.delete('estado')
    }
    setParams(nextParams, { replace: true })
  }

  if (!perfil) return null

  const puedeMover = tienePermiso(perfil, 'ajustar_stock')
  const mostrarUbicaciones = ubicaciones.length >= 2
  const columnasCasaStand = mostrarUbicaciones && esCasaStand(ubicaciones)
  const columnasDinamicas = mostrarUbicaciones && !columnasCasaStand

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <AppNav />
        <PageTitle
          titulo="Inventario"
          subtitulo={
            tab === 'lotes'
              ? 'Lotes y vencimientos'
              : tab === 'movimientos'
                ? 'Kardex de movimientos'
                : `${visibles.length} productos`
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === 'stock' ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'}`}
            onClick={() => irTab('stock')}
          >
            Stock actual
          </button>
          {usaLotes ? (
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === 'lotes' ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'}`}
              onClick={() => irTab('lotes', estadoLoteParam)}
            >
              Lotes
            </button>
          ) : null}
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === 'movimientos' ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'}`}
            onClick={() => irTab('movimientos')}
          >
            Movimientos
          </button>
        </div>

        {tab === 'lotes' && usaLotes ? (
          <InventarioLotesTab
            empresaId={perfil.empresa.id}
            puedeEditar={puedeMover}
            estadoInicial={estadoLoteParam}
            onEstado={(estado) => irTab('lotes', estado)}
          />
        ) : null}

        {tab === 'movimientos' ? (
          <div>
            <label className="mb-4 block text-sm" style={{ color: 'var(--text-muted)' }}>
              Producto
              <select
                className="mt-1.5 h-11 w-full max-w-md rounded-md border px-3 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}
                value={historial?.id ?? ''}
                onChange={(ev) => {
                  const fila = filas.find((f) => f.id === ev.target.value)
                  setHistorial(fila ?? null)
                }}
              >
                <option value="">Elegí un producto</option>
                {filas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
            {historial ? (
              <HistorialMovimientosPanel
                key={historial.id}
                producto={{ id: historial.id, nombre: historial.nombre, stock: historial.stock_actual }}
                puedeAjustar={puedeMover}
                embedded
                mostrarLote={usaLotes}
                onCerrar={() => setHistorial(null)}
                onAjustar={() => {
                  setAjuste(historial)
                  setHistorial(null)
                }}
              />
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Elegí un producto para ver el historial de movimientos.
              </p>
            )}
          </div>
        ) : null}

        {tab === 'stock' ? (
        <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <FilterCollapse activo={estadoFiltro !== 'todos' || Boolean(categoria)}>
            <div className="filter-field">
              <label htmlFor="inv-estado">Estado</label>
              <select
                id="inv-estado"
                value={estadoFiltro}
                onChange={(ev) => setEstadoFiltro(ev.target.value as 'todos' | EstadoStock)}
              >
                <option value="todos">Todos</option>
                <option value="sin">Sin stock</option>
                <option value="bajo">Stock bajo</option>
                <option value="normal">Normal</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="inv-cat">Categoría</label>
              <select id="inv-cat" value={categoria} onChange={(ev) => setCategoria(ev.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </FilterCollapse>
          {puedeMover && mostrarUbicaciones ? (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#6366F1] px-4 text-sm font-semibold text-white hover:bg-[#4F46E5]"
              onClick={() => {
                void listarProductosNombres(requireSupabase()).then((r) => {
                  if (!r.error) setProductos(r.filas)
                  setTraslado(true)
                })
              }}
            >
              Registrar traslado
            </button>
          ) : null}
        </div>

        {mostrarUbicaciones ? (
          <section
            className="mb-6 rounded-xl p-4"
            style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
          >
            <h2 className="text-sm font-semibold">Traslados</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {columnasCasaStand
                ? 'Mové stock entre Casa y Stand. El total del producto no cambia.'
                : 'Mové stock entre ubicaciones. El total del producto no cambia.'}
            </p>
          </section>
        ) : null}

        {cargando ? (
          <PageSkeleton />
        ) : (
        <TableCard>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left">
              <thead className={theadClass} style={theadStyle}>
                <tr>
                  <Th>Producto</Th>
                  <Th>Categoría</Th>
                  <Th>Stock</Th>
                  {columnasCasaStand ? <Th>Casa</Th> : null}
                  {columnasCasaStand ? <Th>Stand</Th> : null}
                  {columnasDinamicas
                    ? ubicaciones.map((u) => <Th key={u.id}>{u.nombre}</Th>)
                    : null}
                  <Th>Última entrada</Th>
                  <Th>Última salida</Th>
                  <Th>Rotación 30d</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              {!cargando && error !== MSG_ERROR_RED ? (
                <tbody>
                  {visibles.map((fila, index) => {
                    const est = etiquetaEstadoStock(estadoStock(fila.stock_actual, umbral))
                    return (
                      <Tr key={fila.id} index={index}>
                        <td className="px-3 py-3 font-medium">
                          {desglose.get(fila.id)?.length ? (
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={() =>
                                setAbiertos((prev) => ({ ...prev, [fila.id]: !prev[fila.id] }))
                              }
                            >
                              {fila.nombre}
                              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                                {abiertos[fila.id] ? '▾' : '▸'}
                              </span>
                            </button>
                          ) : (
                            fila.nombre
                          )}
                          {abiertos[fila.id] && desglose.get(fila.id)?.length ? (
                            <p className="mt-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                              {desglose
                                .get(fila.id)!
                                .map((d) => `${d.etiqueta}: ${d.stock}u`)
                                .join(' | ')}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3" style={{ color: 'var(--text-muted)' }}>
                          {fila.categoria ?? '—'}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="font-semibold text-[#A5B4FC] hover:underline"
                            onClick={() => setHistorial(fila)}
                          >
                            {fila.stock_actual}
                          </button>
                        </td>
                        {columnasCasaStand ? <td className="px-3 py-3">{fila.stock_casa}</td> : null}
                        {columnasCasaStand ? <td className="px-3 py-3">{fila.stock_stand}</td> : null}
                        {columnasDinamicas
                          ? ubicaciones.map((u) => (
                              <td key={u.id} className="px-3 py-3">
                                {stockDe(stockUbic, fila.id, u.nombre)}
                              </td>
                            ))
                          : null}
                        <td className="px-3 py-3">{fechaCorta(fila.ultima_entrada)}</td>
                        <td className="px-3 py-3">{fechaCorta(fila.ultima_salida)}</td>
                        <td className="px-3 py-3">{fila.rotacion_30}</td>
                        <td className="px-3 py-3">
                          {est.icono} {est.texto}
                        </td>
                      </Tr>
                    )
                  })}
                </tbody>
              ) : null}
            </table>
          </div>
          {!cargando && error !== MSG_ERROR_RED ? (
            <MobileCards>
              {visibles.map((fila) => {
                const est = etiquetaEstadoStock(estadoStock(fila.stock_actual, umbral))
                return (
                  <ListCard key={fila.id}>
                    <div className="flex items-start justify-between gap-2">
                    <div>
                      {desglose.get(fila.id)?.length ? (
                        <button
                          type="button"
                          className="text-left text-sm font-semibold"
                          onClick={() =>
                            setAbiertos((prev) => ({ ...prev, [fila.id]: !prev[fila.id] }))
                          }
                        >
                          {fila.nombre} {abiertos[fila.id] ? '▾' : '▸'}
                        </button>
                      ) : (
                        <p className="text-sm font-semibold">{fila.nombre}</p>
                      )}
                      {abiertos[fila.id] && desglose.get(fila.id)?.length ? (
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {desglose
                            .get(fila.id)!
                            .map((d) => `${d.etiqueta}: ${d.stock}u`)
                            .join(' | ')}
                        </p>
                      ) : null}
                    </div>
                      <span className="text-xs">
                        {est.icono} {est.texto}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold text-[#6366F1]"
                      onClick={() => setHistorial(fila)}
                    >
                      Stock {fila.stock_actual}
                    </button>
                    {columnasCasaStand ? (
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Casa {fila.stock_casa} · Stand {fila.stock_stand}
                      </p>
                    ) : null}
                    {columnasDinamicas ? (
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ubicaciones
                          .map((u) => `${u.nombre} ${stockDe(stockUbic, fila.id, u.nombre)}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Rotación 30d: {fila.rotacion_30}
                    </p>
                  </ListCard>
                )
              })}
            </MobileCards>
          ) : null}
          {!cargando && error === MSG_ERROR_RED ? (
            <TableErrorRed onReintentar={() => void cargar()} />
          ) : null}
          {!cargando && visibles.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay productos con esos filtros.
            </p>
          ) : null}
        </TableCard>
        )}
        </>
        ) : null}
      </div>

      {historial && tab === 'stock' ? (
        <HistorialMovimientosPanel
          key={historial.id}
          producto={{ id: historial.id, nombre: historial.nombre, stock: historial.stock_actual }}
          puedeAjustar={puedeMover}
          mostrarLote={usaLotes}
          onCerrar={() => setHistorial(null)}
          onAjustar={() => {
            setAjuste(historial)
            setHistorial(null)
          }}
        />
      ) : null}

      {ajuste ? (
        <AjustarStockModal
          producto={{ id: ajuste.id, nombre: ajuste.nombre, stock: ajuste.stock_actual }}
          empresaId={perfil.empresa.id}
          onCerrar={() => setAjuste(null)}
          onOk={() => {
            setAjuste(null)
            void cargar()
          }}
        />
      ) : null}

      {traslado ? (
        <TrasladoModal
          productos={productos}
          ubicaciones={ubicaciones}
          onCerrar={() => setTraslado(false)}
          onOk={() => {
            setTraslado(false)
            void cargar()
          }}
        />
      ) : null}
    </div>
  )
}

function TrasladoModal({
  productos,
  ubicaciones,
  onCerrar,
  onOk,
}: {
  productos: { id: string; nombre: string }[]
  ubicaciones: UbicacionFila[]
  onCerrar: () => void
  onOk: () => void
}) {
  const [productoId, setProductoId] = useState(productos[0]?.id ?? '')
  const [cantidad, setCantidad] = useState('1')
  const [origen, setOrigen] = useState(
    ubicaciones.find((u) => u.nombre === 'Casa')?.nombre ?? ubicaciones[0]?.nombre ?? '',
  )
  const [destino, setDestino] = useState(
    ubicaciones.find((u) => u.nombre === 'Stand')?.nombre ?? ubicaciones[1]?.nombre ?? '',
  )
  const [fecha, setFecha] = useState(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError(null)
    const n = Number.parseInt(cantidad, 10)
    if (!productoId) {
      setError('Elegí un producto')
      return
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError('La cantidad tiene que ser un número positivo')
      return
    }
    setEnviando(true)
    const fallo = await registrarTraslado(requireSupabase(), {
      productoId,
      cantidad: n,
      origen,
      destino,
      fecha,
      notas: notas.trim(),
    })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    onOk()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[440px] rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-bold text-[#1A2F4A]">Registrar traslado</h2>
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Producto
          <select
            className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
            value={productoId}
            onChange={(ev) => setProductoId(ev.target.value)}
          >
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Cantidad
          <input
            className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
            inputMode="numeric"
            value={cantidad}
            onChange={(ev) => setCantidad(ev.target.value)}
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-[#4A5568]">
            De
            <select
              className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
              value={origen}
              onChange={(ev) => setOrigen(ev.target.value)}
            >
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#4A5568]">
            A
            <select
              className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
              value={destino}
              onChange={(ev) => setDestino(ev.target.value)}
            >
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Fecha
          <input
            className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
            type="datetime-local"
            value={fecha}
            onChange={(ev) => setFecha(ev.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Notas
          <input
            className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
            value={notas}
            onChange={(ev) => setNotas(ev.target.value)}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-[#DC2626]">{error}</p> : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="h-11 flex-1 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="h-11 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
