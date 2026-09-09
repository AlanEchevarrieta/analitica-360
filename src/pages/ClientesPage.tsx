import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  PageTitle,
  SearchField,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  Tr,
  btnPrimaryDesk,
  FabLink,
  ListCard,
  MobileCards,
  theadClass,
  theadStyle,
} from '../components/listado'
import { COLOR_ETIQUETA, listarClientes, type ClienteFila } from '../lib/clientes'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function formatoDia(iso: string | null) {
  if (!iso) return '—'
  const raw = String(iso).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('es-AR')
}

export function ClientesPage() {
  const { perfil } = useAuth()
  const [filas, setFilas] = useState<ClienteFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, error: listError } = await listarClientes(requireSupabase())
    setCargando(false)
    if (listError) {
      const msg = mensajeCargaTabla(listError)
      if (msg) setError(msg)
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
    return filas.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) || (c.telefono ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')),
    )
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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <AppNav />
        <PageTitle
          titulo="Clientes"
          subtitulo={`${filas.length} ${filas.length === 1 ? 'cliente' : 'clientes'}`}
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SearchField value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o teléfono" />
          {perfil.usuario.rol !== 'visor' ? (
            <Link className={btnPrimaryDesk} to="/clientes/nuevo">
              Nuevo cliente
            </Link>
          ) : null}
        </div>

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Nombre</Th>
                <Th>Teléfono</Th>
                <Th>Última compra</Th>
                <Th>Total gastado</Th>
                <Th>Compras</Th>
                <Th>Etiquetas</Th>
                <Th />
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
            <tbody>
              {visibles.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 font-medium">
                    <Link
                      className="text-[#F1F5F9] underline-offset-2 decoration-[#6366F1]/50 hover:text-[#6366F1] hover:underline"
                      to={`/clientes/${fila.id}`}
                    >
                      {fila.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[#E2E8F0]">{fila.telefono ?? '—'}</td>
                  <td className="px-3 py-3 text-[#E2E8F0]">{formatoDia(fila.ultima_compra)}</td>
                  <td className="px-3 py-3 font-semibold text-[#4ADE80]">{formatoARS(fila.total_gastado)}</td>
                  <td className="px-3 py-3">{fila.cantidad_compras}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {fila.etiquetas.length === 0 ? (
                        <span className="text-[#94A3B8]">—</span>
                      ) : (
                        fila.etiquetas.map((e) => {
                          const c = COLOR_ETIQUETA[e] ?? { bg: 'rgba(148,163,184,0.12)', fg: '#94A3B8' }
                          return (
                            <span
                              key={e}
                              className="etiqueta-cliente etiqueta-on rounded-full px-2 py-0.5 text-[11px] font-medium"
                              data-etiqueta={e}
                              style={{ background: c.bg, color: c.fg }}
                            >
                              {e}
                            </span>
                          )
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      className="inline-flex rounded-lg p-1.5 text-[#94A3B8] hover:text-[#6366F1]"
                      to={`/clientes/${fila.id}`}
                      state={{ editar: true }}
                      title="Editar"
                      aria-label={`Editar ${fila.nombre}`}
                    >
                      ✏️
                    </Link>
                  </td>
                </Tr>
              ))}
            </tbody>
            ) : null}
          </table>
          </div>
          {!cargando && error !== MSG_ERROR_RED ? (
            <MobileCards>
              {visibles.map((fila) => (
                <ListCard key={fila.id} to={`/clientes/${fila.id}`}>
                  <p className="text-sm font-semibold">{fila.nombre}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fila.telefono ?? 'Sin teléfono'}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#4ADE80]">{formatoARS(fila.total_gastado)}</p>
                </ListCard>
              ))}
            </MobileCards>
          ) : null}
          {cargando ? <TableSkeleton /> : null}
          {!cargando && error === MSG_ERROR_RED ? (
            <TableErrorRed onReintentar={() => void cargar()} />
          ) : null}
          {!cargando && visibles.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">
              {filas.length === 0 ? 'Todavía no hay clientes.' : 'Ningún cliente coincide con la búsqueda.'}
            </p>
          ) : null}
        </TableCard>
        {perfil.usuario.rol !== 'visor' ? <FabLink to="/clientes/nuevo" label="Nuevo cliente" /> : null}
      </div>
    </div>
  )
}
