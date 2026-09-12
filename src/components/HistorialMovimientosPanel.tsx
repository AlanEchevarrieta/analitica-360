import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PAGE_MOVIMIENTOS, PaginacionBar } from './listado'
import {
  estiloTipoMovimiento,
  formatoFechaMov,
  listarKardexProducto,
  type MovimientoKardex,
} from '../lib/inventario'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'

const FILA_BG = 'rgba(15,23,41,0.95)'
const FILA_BORDE = '1px solid rgba(99,102,241,0.15)'
const TXT = '#F1F5F9'
const TXT_SEC = '#94A3B8'

function textoReferencia(m: MovimientoKardex) {
  if (m.tipo === 'venta' && m.referenciaId) {
    const fecha = m.ventaFecha ? formatoFechaMov(m.ventaFecha) : formatoFechaMov(m.fecha)
    return { to: '/ventas', label: `Venta ${fecha}` }
  }
  if (m.tipo === 'compra' && m.motivo) return { to: '/compras', label: m.motivo }
  if (m.tipo === 'transferencia' && (m.ubicacionOrigen || m.ubicacionDestino)) {
    return { to: null, label: `${m.ubicacionOrigen ?? '—'} → ${m.ubicacionDestino ?? '—'}` }
  }
  if (m.motivo) return { to: null, label: m.motivo }
  return { to: null, label: '—' }
}

export function HistorialMovimientosPanel({
  producto,
  puedeAjustar,
  onCerrar,
  onAjustar,
  embedded,
  mostrarLote,
}: {
  producto: { id: string; nombre: string; stock: number }
  puedeAjustar: boolean
  onCerrar: () => void
  onAjustar?: () => void
  embedded?: boolean
  mostrarLote?: boolean
}) {
  const [filas, setFilas] = useState<MovimientoKardex[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    void listarKardexProducto(requireSupabase(), producto.id, {
      pagina,
      pageSize: PAGE_MOVIMIENTOS,
      stockActual: producto.stock,
    }).then((res) => {
      if (!vivo) return
      setCargando(false)
      setError(res.error)
      setFilas(res.filas)
      setTotal(res.total)
    })
    return () => {
      vivo = false
    }
  }, [producto.id, producto.stock, pagina])

  const colLote = Boolean(mostrarLote) || filas.some((m) => Boolean(m.numeroLote))
  const colVariante = filas.some((m) => m.varianteEtiqueta)

  const cuerpo = (
    <>
      {puedeAjustar && onAjustar ? (
        <div className={embedded ? 'mb-3' : 'px-4 pt-3'}>
          <button type="button" className="text-sm font-semibold text-[#6366F1]" onClick={onAjustar}>
            Ajustar stock
          </button>
        </div>
      ) : null}
      <div className={embedded ? 'overflow-auto' : 'min-h-0 flex-1 overflow-auto px-4 py-3'}>
        {cargando ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Cargando…
          </p>
        ) : null}
        {error ? <p className="text-sm text-[#F87171]">{error}</p> : null}
        {!cargando && !error && filas.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no hay movimientos.
          </p>
        ) : null}
        {!cargando && filas.length > 0 ? (
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr style={{ color: TXT_SEC }}>
                <th className="py-2 pr-2 font-semibold">Fecha</th>
                <th className="py-2 pr-2 font-semibold">Tipo</th>
                <th className="py-2 pr-2 font-semibold">Cant.</th>
                <th className="py-2 pr-2 font-semibold">Precio unitario</th>
                {colVariante ? <th className="py-2 pr-2 font-semibold">Variante</th> : null}
                {colLote ? <th className="py-2 pr-2 font-semibold">Lote</th> : null}
                <th className="py-2 pr-2 font-semibold">Referencia</th>
                <th className="py-2 pr-2 font-semibold">Usuario</th>
                <th className="py-2 font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => {
                const tipo = estiloTipoMovimiento(m.tipo, m.signo)
                const ref = textoReferencia(m)
                const entrada = m.signo >= 0
                return (
                  <tr
                    key={m.id}
                    style={{
                      background: FILA_BG,
                      borderBottom: FILA_BORDE,
                      color: TXT,
                    }}
                  >
                    <td className="py-2.5 pr-2 whitespace-nowrap" style={{ color: TXT_SEC }}>
                      {formatoFechaMov(m.fecha)}
                    </td>
                    <td className="py-2.5 pr-2">
                      <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                        style={{ background: tipo.fondo, color: tipo.color }}
                      >
                        {tipo.icono} {tipo.texto}
                      </span>
                    </td>
                    <td
                      className="py-2.5 pr-2 font-semibold tabular-nums"
                      style={{ color: entrada ? '#4ADE80' : '#F87171' }}
                    >
                      {entrada ? '+' : '-'}
                      {m.cantidad}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums" style={{ color: TXT }}>
                      {m.precioUnitario != null ? formatoARS(m.precioUnitario) : '—'}
                    </td>
                    {colVariante ? (
                      <td className="py-2.5 pr-2" style={{ color: TXT_SEC }}>
                        {m.varianteEtiqueta ?? '—'}
                      </td>
                    ) : null}
                    {colLote ? (
                      <td className="py-2.5 pr-2" style={{ color: TXT_SEC }}>
                        {m.numeroLote ?? '—'}
                      </td>
                    ) : null}
                    <td className="py-2.5 pr-2" style={{ color: TXT_SEC }}>
                      {ref.to ? (
                        <Link className="text-[#A5B4FC] underline" to={ref.to}>
                          {ref.label}
                        </Link>
                      ) : (
                        ref.label
                      )}
                    </td>
                    <td className="py-2.5 pr-2" style={{ color: TXT_SEC }}>
                      {m.usuarioNombre}
                    </td>
                    <td
                      className="py-2.5 font-medium tabular-nums"
                      style={{
                        background: m.saldo > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                        color: TXT,
                      }}
                    >
                      {m.saldo}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
        {!cargando && !error && total > 0 ? (
          <div className="mt-3">
            <PaginacionBar
              pagina={pagina}
              total={total}
              pageSize={PAGE_MOVIMIENTOS}
              onPagina={setPagina}
              entidad="movimientos"
            />
          </div>
        ) : null}
      </div>
    </>
  )

  if (embedded) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
      >
        <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {producto.nombre} · stock {producto.stock}
        </p>
        {cuerpo}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/50" type="button" aria-label="Cerrar" onClick={onCerrar} />
      <aside
        className="relative flex h-full w-full max-w-2xl flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.35)]"
        style={{ background: 'var(--card-bg)', color: 'var(--text)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-lg font-semibold">Movimientos</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {producto.nombre} · stock {producto.stock}
            </p>
          </div>
          <button type="button" className="text-sm text-[#A5B4FC]" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        {cuerpo}
      </aside>
    </div>
  )
}
