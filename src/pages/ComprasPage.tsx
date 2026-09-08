import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  PageTitle,
  SearchField,
  TableCard,
  Th,
  Tr,
  btnPrimary,
  theadClass,
  theadStyle,
} from '../components/listado'
import { formatoFechaCompra, listarCompras, type CompraFila } from '../lib/compras'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

export function ComprasPage() {
  const { perfil, cerrarSesion } = useAuth()
  const [filas, setFilas] = useState<CompraFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, error: listError } = await listarCompras(requireSupabase())
    setCargando(false)
    if (listError) {
      setError(listError)
      return
    }
    setError(null)
    setFilas(data)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) => (f.proveedor ?? '').toLowerCase().includes(q))
  }, [busqueda, filas])

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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 text-white">
        <AppNav />
        <PageTitle
          titulo="Compras"
          subtitulo={`${filas.length} ${filas.length === 1 ? 'compra registrada' : 'compras registradas'}`}
          accion={
            <button
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white"
              type="button"
              onClick={() => void cerrarSesion()}
            >
              Cerrar sesión
            </button>
          }
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SearchField value={busqueda} onChange={setBusqueda} placeholder="Buscar por proveedor" />
          <Link className={btnPrimary} to="/compras/nueva">
            Nueva compra
          </Link>
        </div>

        {error ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <table className="w-full min-w-[720px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Fecha</Th>
                <Th>Proveedor</Th>
                <Th>Productos</Th>
                <Th>Total</Th>
                <Th>Notas</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 whitespace-nowrap text-[#E2E8F0]">{formatoFechaCompra(fila.fecha)}</td>
                  <td className="px-3 py-3">
                    {fila.proveedor ? (
                      <span>🏭 {fila.proveedor}</span>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{fila.productos || '—'}</td>
                  <td className="px-3 py-3 font-bold text-[#6366F1]">{formatoARS(fila.total)}</td>
                  <td className="px-3 py-3 text-[#94A3B8]">{fila.notas ?? '—'}</td>
                </Tr>
              ))}
            </tbody>
          </table>
          {!cargando && visibles.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">
              {filas.length === 0 ? 'Todavía no hay compras.' : 'Ningún proveedor coincide con la búsqueda.'}
            </p>
          ) : null}
        </TableCard>
      </div>
    </div>
  )
}
