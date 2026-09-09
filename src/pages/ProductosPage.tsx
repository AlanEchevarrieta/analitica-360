import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { AppNav } from '../components/AppNav'
import {
  BadgeEstado,
  BadgeMargen,
  IconBtn,
  PAGE_PRODUCTOS,
  PageTitle,
  PaginacionBar,
  SearchField,
  StockCelda,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  ThFilter,
  Tr,
  btnPrimaryDesk,
  FabLink,
  FilterCollapse,
  ListCard,
  MobileCards,
  theadClass,
  theadStyle,
} from '../components/listado'
import { AjustarStockModal } from '../components/AjustarStockModal'
import { ImportarExcelModal } from '../components/ImportarExcelModal'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import {
  actualizarProducto,
  formatoARS,
  listarProductos,
  listarProductosPaginado,
  type ProductoFila,
} from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function margenPct(precio: number, costo: number) {
  if (precio <= 0) return null
  return ((precio - costo) / precio) * 100
}

function stockDesdeQuery(valor: string | null): 'todos' | 'con' | 'sin' | 'bajo' {
  if (valor === 'con' || valor === 'sin' || valor === 'bajo') return valor
  return 'todos'
}

export function ProductosPage() {
  const { perfil } = useAuth()
  const [searchParams] = useSearchParams()
  const [filas, setFilas] = useState<ProductoFila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos')
  const [stockFiltro, setStockFiltro] = useState<'todos' | 'con' | 'sin' | 'bajo'>(() =>
    stockDesdeQuery(searchParams.get('stock')),
  )
  const [margenFiltro, setMargenFiltro] = useState<'todos' | 'alto' | 'medio' | 'bajo'>('todos')
  const [menu, setMenu] = useState<'cat' | 'estado' | 'stock' | 'margen' | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [importar, setImportar] = useState(false)
  const [existentesImport, setExistentesImport] = useState<ProductoFila[]>([])
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [activos, setActivos] = useState(0)
  const [categorias, setCategorias] = useState<string[]>([])
  const [ajuste, setAjuste] = useState<{ id: string; nombre: string; stock: number } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, total: n, activos: nActivos, categorias: cats, error: listError } =
      await listarProductosPaginado(requireSupabase(), {
        pagina,
        pageSize: PAGE_PRODUCTOS,
        busqueda,
        categoria,
        estado,
        stock: stockFiltro,
        margen: margenFiltro,
      })
    setCargando(false)
    if (listError) {
      const msg = mensajeCargaTabla(listError)
      if (msg) {
        setError(
          msg === MSG_ERROR_RED
            ? MSG_ERROR_RED
            : 'No se pudieron cargar los productos. Corré supabase/006_productos.sql en el SQL Editor.',
        )
      }
      return
    }
    setError(null)
    setFilas(data)
    setTotal(n)
    setActivos(nActivos)
    setCategorias(cats)
  }, [pagina, busqueda, categoria, estado, stockFiltro, margenFiltro])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const raw = searchParams.get('stock')
    if (raw == null) return
    const fromUrl = stockDesdeQuery(raw)
    setStockFiltro(fromUrl)
    setPagina(1)
  }, [searchParams])

  if (!perfil) return null

  const puedeEditar = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'editar_productos')
  const puedeVerCostos = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'ver_costos')
  const puedeAjustar = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'ajustar_stock')

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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <AppNav />
        <PageTitle
          titulo="Productos"
          subtitulo={`${activos} ${activos === 1 ? 'producto activo' : 'productos activos'}`}
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            value={busqueda}
            onChange={(v) => {
              setPagina(1)
              setBusqueda(v)
            }}
            placeholder="Buscar producto..."
          />
          {puedeEditar ? (
            <div className="hidden flex-wrap gap-2 md:flex">
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC] hover:bg-white/5"
                type="button"
                onClick={() => {
                  void listarProductos(requireSupabase()).then(({ filas: data, error: listError }) => {
                    if (listError) {
                      setError(
                        'No se pudieron cargar los productos. Corré supabase/006_productos.sql en el SQL Editor.',
                      )
                      return
                    }
                    setExistentesImport(data)
                    setImportar(true)
                  })
                }}
              >
                Importar Excel
              </button>
              <Link className={btnPrimaryDesk} to="/productos/nuevo">
                <span aria-hidden>➕</span> Nuevo producto
              </Link>
            </div>
          ) : null}
        </div>
        <div className="mb-4">
          <FilterCollapse
            soloMobile
            activo={stockFiltro !== 'todos' || estado !== 'todos' || Boolean(categoria) || margenFiltro !== 'todos'}
          >
            <div className="filter-field">
              <label htmlFor="prod-cat">Categoría</label>
              <select
                id="prod-cat"
                className="filter-control"
                value={categoria}
                onChange={(ev) => {
                  setPagina(1)
                  setCategoria(ev.target.value)
                }}
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="prod-stock">Stock</label>
              <select
                id="prod-stock"
                className="filter-control"
                value={stockFiltro}
                onChange={(ev) => {
                  setPagina(1)
                  setStockFiltro(ev.target.value as typeof stockFiltro)
                }}
              >
                <option value="todos">Todos</option>
                <option value="con">Con stock</option>
                <option value="sin">Sin stock</option>
                <option value="bajo">Stock bajo</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="prod-estado">Estado</label>
              <select
                id="prod-estado"
                className="filter-control"
                value={estado}
                onChange={(ev) => {
                  setPagina(1)
                  setEstado(ev.target.value as typeof estado)
                }}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
          </FilterCollapse>
        </div>

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Nombre</Th>
                <ThFilter
                  label="Categoría"
                  active={Boolean(categoria)}
                  open={menu === 'cat'}
                  onToggle={() => setMenu((m) => (m === 'cat' ? null : 'cat'))}
                  onClose={closeMenu}
                >
                  <button
                    className={`col-filter-option${categoria === '' ? ' selected' : ''}`}
                    type="button"
                    onClick={() => {
                      setPagina(1)
                      setCategoria('')
                      closeMenu()
                    }}
                  >
                    Todas las categorías
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c}
                      className={`col-filter-option${categoria === c ? ' selected' : ''}`}
                      type="button"
                      onClick={() => {
                        setPagina(1)
                        setCategoria(c)
                        closeMenu()
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </ThFilter>
                <Th>Precio de venta</Th>
                {puedeVerCostos ? <Th>Costo</Th> : null}
                {puedeVerCostos ? (
                  <ThFilter
                    label="Margen"
                    active={margenFiltro !== 'todos'}
                    open={menu === 'margen'}
                    onToggle={() => setMenu((m) => (m === 'margen' ? null : 'margen'))}
                    onClose={closeMenu}
                  >
                    {(
                      [
                        ['todos', 'Todos'],
                        ['alto', 'Alto +40%'],
                        ['medio', 'Medio 20-40%'],
                        ['bajo', 'Bajo -20%'],
                      ] as const
                    ).map(([id, texto]) => (
                      <button
                        key={id}
                        className={`col-filter-option${margenFiltro === id ? ' selected' : ''}`}
                        type="button"
                        onClick={() => {
                          setPagina(1)
                          setMargenFiltro(id)
                          closeMenu()
                        }}
                      >
                        {texto}
                      </button>
                    ))}
                  </ThFilter>
                ) : null}
                <ThFilter
                  label="Stock actual"
                  active={stockFiltro !== 'todos'}
                  open={menu === 'stock'}
                  onToggle={() => setMenu((m) => (m === 'stock' ? null : 'stock'))}
                  onClose={closeMenu}
                >
                  {(
                    [
                      ['todos', 'Todos'],
                      ['con', 'Con stock'],
                      ['sin', 'Sin stock'],
                      ['bajo', 'Stock bajo'],
                    ] as const
                  ).map(([id, texto]) => (
                    <button
                      key={id}
                      className={`col-filter-option${stockFiltro === id ? ' selected' : ''}`}
                      type="button"
                      onClick={() => {
                        setPagina(1)
                        setStockFiltro(id)
                        closeMenu()
                      }}
                    >
                      {texto}
                    </button>
                  ))}
                </ThFilter>
                <ThFilter
                  label="Estado"
                  active={estado !== 'todos'}
                  open={menu === 'estado'}
                  onToggle={() => setMenu((m) => (m === 'estado' ? null : 'estado'))}
                  onClose={closeMenu}
                >
                  {(
                    [
                      ['todos', 'Todos'],
                      ['activos', 'Activos'],
                      ['inactivos', 'Inactivos'],
                    ] as const
                  ).map(([id, texto]) => (
                    <button
                      key={id}
                      className={`col-filter-option${estado === id ? ' selected' : ''}`}
                      type="button"
                      onClick={() => {
                        setPagina(1)
                        setEstado(id)
                        closeMenu()
                      }}
                    >
                      {texto}
                    </button>
                  ))}
                </ThFilter>
                {puedeEditar ? <Th /> : null}
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
            <tbody>
              {filas.map((fila, index) => (
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
                    <StockCelda
                      stock={fila.stock_actual}
                      onClick={
                        puedeAjustar
                          ? () =>
                              setAjuste({
                                id: fila.id,
                                nombre: fila.nombre,
                                stock: fila.stock_actual,
                              })
                          : undefined
                      }
                    />
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
            ) : null}
          </table>
          </div>
          {!cargando && error !== MSG_ERROR_RED ? (
            <MobileCards>
              {filas.map((fila) => (
                <ListCard key={fila.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{fila.nombre}</p>
                    <BadgeEstado activo={fila.activo} />
                  </div>
                  <p className="mt-1 text-sm">{formatoARS(fila.precio_venta)}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Stock:{' '}
                    <StockCelda
                      stock={fila.stock_actual}
                      onClick={
                        puedeAjustar
                          ? () =>
                              setAjuste({
                                id: fila.id,
                                nombre: fila.nombre,
                                stock: fila.stock_actual,
                              })
                          : undefined
                      }
                    />
                  </p>
                  {puedeEditar ? (
                    <Link className="mt-2 inline-block text-xs font-semibold text-[#6366F1]" to={`/productos/${fila.id}`}>
                      Editar
                    </Link>
                  ) : null}
                </ListCard>
              ))}
            </MobileCards>
          ) : null}
          {cargando ? <TableSkeleton /> : null}
          {!cargando && error === MSG_ERROR_RED ? (
            <TableErrorRed onReintentar={() => void cargar()} />
          ) : null}
          {!cargando && filas.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {total === 0
                ? 'Todavía no hay productos.'
                : 'Ningún producto coincide con la búsqueda o los filtros.'}
            </p>
          ) : null}
        </TableCard>
        {!cargando && error !== MSG_ERROR_RED ? (
        <PaginacionBar
          pagina={pagina}
          total={total}
          pageSize={PAGE_PRODUCTOS}
          onPagina={setPagina}
          entidad="productos"
        />
        ) : null}
        {importar ? (
          <ImportarExcelModal
            existentes={existentesImport}
            onCerrar={() => setImportar(false)}
            onListo={cargar}
          />
        ) : null}
        {ajuste ? (
          <AjustarStockModal
            producto={ajuste}
            onCerrar={() => setAjuste(null)}
            onOk={() => {
              setAjuste(null)
              void cargar()
            }}
          />
        ) : null}
        {puedeEditar ? <FabLink to="/productos/nuevo" label="Nuevo producto" /> : null}
      </div>
    </div>
  )
}
