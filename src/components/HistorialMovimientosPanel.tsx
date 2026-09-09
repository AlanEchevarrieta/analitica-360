import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PAGE_MOVIMIENTOS, PaginacionBar } from './listado'
import {
  estiloTipoMovimiento,
  formatoFechaMov,
  listarKardexProducto,
  type MovimientoKardex,
} from '../lib/inventario'
import { requireSupabase } from '../lib/supabase'

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
}: {
  producto: { id: string; nombre: string; stock: number }
  puedeAjustar: boolean
  onCerrar: () => void
  onAjustar?: () => void
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/50" type="button" aria-label="Cerrar" onClick={onCerrar} />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.35)]"
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
        {puedeAjustar && onAjustar ? (
          <div className="px-4 pt-3">
            <button
              type="button"
              className="text-sm font-semibold text-[#6366F1]"
              onClick={onAjustar}
            >
              Ajustar stock
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
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
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr style={{ color: 'var(--th-fg)' }}>
                  <th className="py-2 pr-2 font-semibold">Fecha</th>
                  <th className="py-2 pr-2 font-semibold">Tipo</th>
                  <th className="py-2 pr-2 font-semibold">Cant.</th>
                  <th className="py-2 pr-2 font-semibold">Referencia</th>
                  <th className="py-2 pr-2 font-semibold">Usuario</th>
                  <th className="py-2 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => {
                  const tipo = estiloTipoMovimiento(m.tipo, m.signo)
                  const ref = textoReferencia(m)
                  const cant = `${m.signo < 0 ? '−' : '+'}${m.cantidad}`
                  return (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--row-border)' }}>
                      <td className="py-2 pr-2 whitespace-nowrap">{formatoFechaMov(m.fecha)}</td>
                      <td className={`py-2 pr-2 ${tipo.clase}`}>
                        {tipo.icono} {tipo.texto}
                      </td>
                      <td className={`py-2 pr-2 font-medium ${tipo.clase}`}>{cant}</td>
                      <td className="py-2 pr-2">
                        {ref.to ? (
                          <Link className="text-[#A5B4FC] underline" to={ref.to}>
                            {ref.label}
                          </Link>
                        ) : (
                          ref.label
                        )}
                      </td>
                      <td className="py-2 pr-2">{m.usuarioNombre}</td>
                      <td className="py-2 font-medium">{m.saldo}</td>
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
      </aside>
    </div>
  )
}
