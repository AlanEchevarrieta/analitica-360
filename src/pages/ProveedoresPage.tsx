import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  BadgeEstado,
  PAGE_PROVEEDORES,
  PageTitle,
  PaginacionBar,
  SearchField,
  PageSkeleton,
  TableCard,
  TableErrorRed,
  Th,
  Tr,
  btnPrimary,
  theadClass,
  theadStyle,
} from '../components/listado'
import { linkWhatsApp } from '../lib/clientes'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import { listarProveedoresPaginado, etiquetaProveedor, type ProveedorFila } from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

export function ProveedoresPage() {
  const { perfil } = useAuth()
  const [filas, setFilas] = useState<ProveedorFila[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, total: n, error: listError } = await listarProveedoresPaginado(requireSupabase(), {
      pagina,
      pageSize: PAGE_PROVEEDORES,
      busqueda,
    })
    setCargando(false)
    if (listError) {
      const msg = mensajeCargaTabla(listError)
      if (msg) setError(msg)
      return
    }
    setError(null)
    setFilas(data)
    setTotal(n)
  }, [pagina, busqueda])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!perfil) return null

  const puedeEditar = perfil.usuario.rol !== 'visor'

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
          titulo="Proveedores"
          subtitulo={`${total} ${total === 1 ? 'proveedor' : 'proveedores'}`}
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SearchField
            value={busqueda}
            onChange={(v) => {
              setPagina(1)
              setBusqueda(v)
            }}
            placeholder="Buscar por nombre"
          />
          {puedeEditar ? (
            <Link className={btnPrimary} to="/proveedores/nuevo">
              Nuevo proveedor
            </Link>
          ) : null}
        </div>

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        {cargando ? (
          <PageSkeleton />
        ) : (
        <TableCard>
          <table className="w-full min-w-[860px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Nombre</Th>
                <Th>Contacto</Th>
                <Th>Teléfono</Th>
                <Th>Productos que provee</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
              <tbody>
                {filas.map((fila, index) => {
                  const wa = linkWhatsApp(fila.telefono)
                  return (
                    <Tr key={fila.id} index={index}>
                      <td className="px-3 py-3 font-medium">
                        <Link
                          className="text-[#F1F5F9] underline-offset-2 decoration-[#6366F1]/50 hover:text-[#6366F1] hover:underline"
                          to={`/proveedores/${fila.id}`}
                        >
                          {etiquetaProveedor(fila)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{fila.nombre_vendedor ?? '—'}</td>
                      <td className="px-3 py-3">
                        {fila.telefono ? (
                          wa ? (
                            <a
                              className="text-[#6366F1] hover:underline"
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {fila.telefono}
                            </a>
                          ) : (
                            fila.telefono
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 text-[#94A3B8]">{fila.productos_que_provee ?? '—'}</td>
                      <td className="px-3 py-3">
                        <BadgeEstado activo={fila.activo} />
                      </td>
                    </Tr>
                  )
                })}
              </tbody>
            ) : null}
          </table>
          {!cargando && error === MSG_ERROR_RED ? (
            <TableErrorRed onReintentar={() => void cargar()} />
          ) : null}
          {!cargando && filas.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {total === 0 ? 'Todavía no hay proveedores.' : 'Ningún proveedor coincide con la búsqueda.'}
            </p>
          ) : null}
        </TableCard>
        )}
        <PaginacionBar
          pagina={pagina}
          total={total}
          pageSize={PAGE_PROVEEDORES}
          onPagina={setPagina}
          entidad="proveedores"
        />
      </div>
    </div>
  )
}
