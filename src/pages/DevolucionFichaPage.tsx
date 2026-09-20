import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, PageSkeleton, btnPrimary, cardShell } from '../components/listado'
import { mostrarToast } from '../lib/consulta'
import {
  cancelarDevolucion,
  diferenciaCambio,
  etiquetaEstadoDevolucion,
  etiquetaTipoDevolucion,
  estiloEstadoDevolucion,
  estiloTipoDevolucion,
  formatoFechaDevolucion,
  obtenerDevolucion,
  totalItems,
  type DevolucionFicha,
} from '../lib/devoluciones'
import { formatoARS } from '../lib/productos'
import { etiquetaMovimiento } from '../lib/stock'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function Badge({ texto, fg, bg }: { texto: string; fg: string; bg: string }) {
  return (
    <span className="inline-flex rounded-full px-2.5 py-[3px] text-xs font-semibold" style={{ color: fg, background: bg }}>
      {texto}
    </span>
  )
}

function TablaItems({
  titulo,
  items,
}: {
  titulo: string
  items: DevolucionFicha['items']
}) {
  if (items.length === 0) return null
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {titulo}
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="px-2 py-2 font-medium">Producto</th>
              <th className="px-2 py-2 font-medium">Cant.</th>
              <th className="px-2 py-2 font-medium">Precio</th>
              <th className="px-2 py-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-white/10">
                <td className="px-2 py-2">{i.nombre}</td>
                <td className="px-2 py-2">{i.cantidad}</td>
                <td className="px-2 py-2">{formatoARS(i.precioUnitario)}</td>
                <td className="px-2 py-2">{formatoARS(i.cantidad * i.precioUnitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DevolucionFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [ficha, setFicha] = useState<DevolucionFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const { data, error: fallo } = await obtenerDevolucion(requireSupabase(), id)
    setCargando(false)
    if (fallo || !data) {
      setError(fallo ?? 'No se encontró el registro')
      setFicha(null)
      return
    }
    setError(null)
    setFicha(data)
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const devueltos = useMemo(() => (ficha?.items ?? []).filter((i) => i.tipo === 'devuelto'), [ficha])
  const entregados = useMemo(() => (ficha?.items ?? []).filter((i) => i.tipo === 'entregado'), [ficha])
  const diff = diferenciaCambio(totalItems(devueltos), totalItems(entregados))

  async function onCancelar() {
    if (!id) return
    setCancelando(true)
    const fallo = await cancelarDevolucion(requireSupabase(), id)
    setCancelando(false)
    if (fallo) {
      mostrarToast(fallo, 'error')
      return
    }
    mostrarToast('Registro cancelado', 'ok')
    void cargar()
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
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Ventas', to: '/ventas' },
            { label: 'Cambios y devoluciones', to: '/ventas?tab=devoluciones' },
            { label: ficha ? `#${ficha.numero ?? '—'}` : 'Ficha' },
          ]}
        />
        {cargando ? <PageSkeleton /> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {ficha && !cargando ? (
          <div className="mt-4 p-5" style={cardShell}>
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const t = estiloTipoDevolucion(ficha.tipo)
                const e = estiloEstadoDevolucion(ficha.estado)
                return (
                  <>
                    <Badge texto={etiquetaTipoDevolucion(ficha.tipo)} fg={t.fg} bg={t.bg} />
                    <Badge texto={etiquetaEstadoDevolucion(ficha.estado)} fg={e.fg} bg={e.bg} />
                  </>
                )
              })()}
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {formatoFechaDevolucion(ficha.fecha)}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text)' }}>
              Venta original:{' '}
              {ficha.ventaId ? (
                <Link className="font-semibold text-[#A5B4FC] hover:underline" to="/ventas">
                  {ficha.ventaLabel}
                </Link>
              ) : (
                'Sin venta vinculada'
              )}
            </p>
            <TablaItems titulo="Productos devueltos" items={devueltos} />
            {ficha.tipo === 'cambio' ? <TablaItems titulo="Productos entregados" items={entregados} /> : null}
            {ficha.tipo === 'cambio' ? (
              <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {diff > 0
                  ? `El cliente debe abonar: ${formatoARS(diff)}`
                  : diff < 0
                    ? `Diferencia a favor del cliente: ${formatoARS(-diff)}`
                    : 'Sin diferencia de precio'}
              </p>
            ) : (
              <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Total a devolver: {formatoARS(totalItems(devueltos))}
              </p>
            )}
            {ficha.motivo ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--text)' }}>
                Motivo: {ficha.motivo}
              </p>
            ) : null}
            {ficha.notas ? (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Notas: {ficha.notas}
              </p>
            ) : null}
            <h2 className="mt-6 text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Movimientos de stock
            </h2>
            {ficha.movimientos.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay movimientos vinculados.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--text)' }}>
                {ficha.movimientos.map((m) => {
                  const et = etiquetaMovimiento(m.tipo)
                  return (
                    <li key={m.id}>
                      {et.icono} {et.texto} · {m.signo > 0 ? '+' : '−'}
                      {m.cantidad} · {formatoFechaDevolucion(m.fecha)}
                    </li>
                  )
                })}
              </ul>
            )}
            {ficha.estado === 'pendiente' ? (
              <button className={`${btnPrimary} mt-6 bg-[#EF4444] hover:bg-[#DC2626]`} type="button" disabled={cancelando} onClick={() => void onCancelar()}>
                {cancelando ? 'Cancelando…' : 'Cancelar'}
              </button>
            ) : null}
          </div>
        ) : null}
        <Link className="mt-6 block text-center text-sm text-[#A5B4FC]" to="/ventas?tab=devoluciones">
          Volver al listado
        </Link>
        {error && !ficha && !cargando ? (
          <button className="mx-auto mt-3 block text-sm text-[#A5B4FC]" type="button" onClick={() => navigate('/ventas?tab=devoluciones')}>
            Ir a cambios y devoluciones
          </button>
        ) : null}
      </div>
    </div>
  )
}
