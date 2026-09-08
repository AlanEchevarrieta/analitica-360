import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { AppNav } from '../components/AppNav'
import {
  BadgeEstado,
  BadgeMargen,
  IconBtn,
  PageTitle,
  SearchField,
  StockCelda,
  TableCard,
  Th,
  Tr,
  btnPrimary,
  theadClass,
  theadStyle,
} from '../components/listado'
import { ImportarExcelModal } from '../components/ImportarExcelModal'
import { actualizarProducto, formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function margenPct(precio: number, costo: number) {
  if (precio <= 0) return null
  return ((precio - costo) / precio) * 100
}

export function ProductosPage() {
  const { perfil, cerrarSesion } = useAuth()
  const [filas, setFilas] = useState<ProductoFila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [importar, setImportar] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, error: listError } = await listarProductos(requireSupabase())
    setCargando(false)
    if (listError) {
      setError(
        'No se pudieron cargar los productos. Corré supabase/006_productos.sql en el SQL Editor.',
      )
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
    return filas.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [busqueda, filas])

  if (!perfil) return null

  const puedeEditar = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'editar_productos')
  const puedeVerCostos = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'ver_costos')
  const activos = filas.filter((p) => p.activo).length

  async function onDesactivar(fila: ProductoFila) {
    if (!window.confirm(`¿Desactivar “${fila.nombre}”?`)) return
    setError(null)
    const fallo = await actualizarProducto(requireSupabase(), {
      id: fila.id,
      nombre: fila.nombre,
      categoria: fila.categoria ?? '',
      precioVenta: fila.precio_venta,
      costo: fila.costo,
      activo: false,
    })
    if (fallo) {
      setError(fallo)
      return
    }
    await cargar()
  }

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
          titulo="Productos"
          subtitulo={`${activos} ${activos === 1 ? 'producto activo' : 'productos activos'}`}
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

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchField value={busqueda} onChange={setBusqueda} placeholder="Buscar producto..." />
          {puedeEditar ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC] hover:bg-white/5"
                type="button"
                onClick={() => setImportar(true)}
              >
                Importar Excel
              </button>
              <Link className={btnPrimary} to="/productos/nuevo">
                <span aria-hidden>➕</span> Nuevo producto
              </Link>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <table className="w-full min-w-[800px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Nombre</Th>
                <Th>Categoría</Th>
                <Th>Precio de venta</Th>
                {puedeVerCostos ? <Th>Costo</Th> : null}
                {puedeVerCostos ? <Th>Margen</Th> : null}
                <Th>Stock actual</Th>
                <Th>Estado</Th>
                {puedeEditar ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 font-medium">{fila.nombre}</td>
                  <td className="px-3 py-3 text-[#94A3B8]">{fila.categoria ?? '—'}</td>
                  <td className="px-3 py-3">{formatoARS(fila.precio_venta)}</td>
                  {puedeVerCostos ? <td className="px-3 py-3">{formatoARS(fila.costo)}</td> : null}
                  {puedeVerCostos ? (
                    <td className="px-3 py-3">
                      <BadgeMargen pct={margenPct(fila.precio_venta, fila.costo)} />
                    </td>
                  ) : null}
                  <td className="px-3 py-3">
                    <StockCelda stock={fila.stock_actual} />
                  </td>
                  <td className="px-3 py-3">
                    <BadgeEstado activo={fila.activo} />
                  </td>
                  {puedeEditar ? (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                          to={`/productos/${fila.id}`}
                          title="Editar"
                          aria-label="Editar"
                        >
                          ✏️
                        </Link>
                        {fila.activo ? (
                          <IconBtn label="Desactivar" onClick={() => void onDesactivar(fila)}>
                            🗑️
                          </IconBtn>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </Tr>
              ))}
            </tbody>
          </table>
          {!cargando && visibles.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">
              {filas.length === 0 ? 'Todavía no hay productos.' : 'Ningún producto coincide con la búsqueda.'}
            </p>
          ) : null}
        </TableCard>
        {importar ? (
          <ImportarExcelModal
            existentes={filas}
            onCerrar={() => setImportar(false)}
            onListo={cargar}
          />
        ) : null}
      </div>
    </div>
  )
}
