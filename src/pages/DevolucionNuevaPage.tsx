import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AccesoDenegado } from '../components/AccesoDenegado'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, btnPrimary, cardShell } from '../components/listado'
import { mostrarToast } from '../lib/consulta'
import {
  MOTIVOS_DEVOLUCION,
  buscarVentasDevolucion,
  diferenciaCambio,
  registrarDevolucion,
  totalItems,
  type TipoDevolucion,
  type VentaDevolucionHit,
} from '../lib/devoluciones'
import { formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

type Linea = {
  uid: string
  productoId: string
  nombre: string
  cantidad: number
  precioUnitario: number
  q: string
}

const inputClass =
  'mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white'

function lineaVacia(): Linea {
  return { uid: crypto.randomUUID(), productoId: '', nombre: '', cantidad: 1, precioUnitario: 0, q: '' }
}

function LineasEditor({
  titulo,
  lineas,
  catalogo,
  onChange,
}: {
  titulo: string
  lineas: Linea[]
  catalogo: ProductoFila[]
  onChange: (next: Linea[]) => void
}) {
  function patch(uid: string, extra: Partial<Linea>) {
    onChange(lineas.map((l) => (l.uid === uid ? { ...l, ...extra } : l)))
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#1A2F4A]">{titulo}</p>
      <div className="space-y-3">
        {lineas.map((l) => {
          const hits = l.q.trim()
            ? catalogo
                .filter((p) => p.nombre.toLowerCase().includes(l.q.trim().toLowerCase()))
                .slice(0, 8)
            : []
          return (
            <div key={l.uid} className="rounded-lg border border-[#E2E8F0] p-3">
              <div className="relative">
                <input
                  className={inputClass}
                  value={l.productoId ? l.nombre : l.q}
                  placeholder="Buscar producto"
                  onChange={(e) => patch(l.uid, { q: e.target.value, productoId: '', nombre: '' })}
                />
                {!l.productoId && hits.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-[#E2E8F0] bg-white shadow-lg">
                    {hits.map((p) => (
                      <li key={p.id}>
                        <button
                          className="block w-full px-3 py-2 text-left text-sm text-[#1A2F4A] hover:bg-[#EEF2F6]"
                          type="button"
                          onClick={() =>
                            patch(l.uid, {
                              productoId: p.id,
                              nombre: p.nombre,
                              q: p.nombre,
                              precioUnitario: l.precioUnitario || p.precio_venta,
                            })
                          }
                        >
                          {p.nombre} · {formatoARS(p.precio_venta)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-[#4A5568]">
                  Cantidad
                  <input
                    className={inputClass}
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={l.cantidad}
                    onChange={(e) => patch(l.uid, { cantidad: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="text-xs text-[#4A5568]">
                  Precio unitario
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.precioUnitario}
                    onChange={(e) => patch(l.uid, { precioUnitario: Number(e.target.value) || 0 })}
                  />
                </label>
                <div className="text-xs text-[#4A5568]">
                  Subtotal
                  <p className="mt-1.5 flex h-11 items-center font-semibold text-[#1A2F4A]">
                    {formatoARS(l.cantidad * l.precioUnitario)}
                  </p>
                </div>
              </div>
              {lineas.length > 1 ? (
                <button
                  className="mt-2 text-xs font-semibold text-[#EF4444]"
                  type="button"
                  onClick={() => onChange(lineas.filter((x) => x.uid !== l.uid))}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      <button
        className="mt-3 text-sm font-semibold text-[#6366F1]"
        type="button"
        onClick={() => onChange([...lineas, lineaVacia()])}
      >
        Agregar otro producto
      </button>
    </div>
  )
}

export function DevolucionNuevaPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1)
  const [tipo, setTipo] = useState<TipoDevolucion>('devolucion')
  const [ventaQ, setVentaQ] = useState('')
  const [ventaHits, setVentaHits] = useState<VentaDevolucionHit[]>([])
  const [venta, setVenta] = useState<VentaDevolucionHit | null>(null)
  const [catalogo, setCatalogo] = useState<ProductoFila[]>([])
  const [devueltos, setDevueltos] = useState<Linea[]>([lineaVacia()])
  const [entregados, setEntregados] = useState<Linea[]>([lineaVacia()])
  const [motivo, setMotivo] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    void listarProductos(requireSupabase()).then((res) => setCatalogo(res.filas.filter((p) => p.activo)))
  }, [])

  useEffect(() => {
    const t = ventaQ.trim()
    if (t.length < 1 || venta) {
      setVentaHits([])
      return
    }
    const h = window.setTimeout(() => {
      void buscarVentasDevolucion(requireSupabase(), t).then(setVentaHits)
    }, 250)
    return () => window.clearTimeout(h)
  }, [ventaQ, venta])

  const totDev = useMemo(
    () => totalItems(devueltos.filter((l) => l.productoId)),
    [devueltos],
  )
  const totEnt = useMemo(
    () => totalItems(entregados.filter((l) => l.productoId)),
    [entregados],
  )
  const diff = diferenciaCambio(totDev, totEnt)

  function aplicarVenta(hit: VentaDevolucionHit) {
    setVenta(hit)
    setVentaQ(hit.label)
    setVentaHits([])
    if (hit.items.length > 0) {
      setDevueltos(
        hit.items.map((i) => ({
          uid: crypto.randomUUID(),
          productoId: i.productoId,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          q: i.nombre,
        })),
      )
    }
  }

  function lineasValidas(lista: Linea[]) {
    return lista.filter((l) => l.productoId && l.cantidad > 0)
  }

  function siguienteDesde1() {
    setError(null)
    setPaso(2)
  }

  function siguienteDesde2() {
    if (lineasValidas(devueltos).length === 0) {
      setError('Agregá al menos un producto devuelto')
      return
    }
    setError(null)
    setPaso(tipo === 'cambio' ? 3 : 4)
  }

  function siguienteDesde3() {
    if (lineasValidas(entregados).length === 0) {
      setError('Agregá al menos un producto entregado')
      return
    }
    setError(null)
    setPaso(4)
  }

  async function confirmar() {
    const itemsDev = lineasValidas(devueltos)
    if (itemsDev.length === 0) {
      setError('Agregá al menos un producto devuelto')
      return
    }
    if (tipo === 'cambio' && lineasValidas(entregados).length === 0) {
      setError('Agregá al menos un producto entregado')
      return
    }
    setEnviando(true)
    setError(null)
    const items = [
      ...itemsDev.map((l) => ({
        productoId: l.productoId,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        tipo: 'devuelto' as const,
      })),
      ...(tipo === 'cambio'
        ? lineasValidas(entregados).map((l) => ({
            productoId: l.productoId,
            nombre: l.nombre,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            tipo: 'entregado' as const,
          }))
        : []),
    ]
    const { id, error: fallo } = await registrarDevolucion(requireSupabase(), {
      tipo,
      ventaId: venta?.id ?? null,
      motivo,
      notas,
      items,
    })
    setEnviando(false)
    if (fallo || !id) {
      setError(fallo ?? 'No se pudo registrar')
      return
    }
    mostrarToast(tipo === 'cambio' ? 'Cambio registrado' : 'Devolución registrada', 'ok')
    navigate(`/ventas/devoluciones/${id}`)
  }

  if (!perfil) return null
  if (!tienePermiso(perfil, 'registrar_ventas')) return <AccesoDenegado />

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-lg px-4 py-8">
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Ventas', to: '/ventas' },
            { label: 'Cambios y devoluciones', to: '/ventas?tab=devoluciones' },
            { label: 'Nueva' },
          ]}
        />
        <div className="mx-auto mt-4 p-6" style={{ ...cardShell, background: 'rgba(255,255,255,0.95)' }}>
          <h1 className="text-xl font-bold text-[#1A2F4A]">Nueva devolución / cambio</h1>
          <p className="mt-1 text-sm text-[#4A5568]">Paso {paso} de {tipo === 'cambio' || paso >= 3 ? 4 : 3}</p>
          {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {paso === 1 ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm font-semibold text-[#1A2F4A]">Tipo</p>
              <label className="flex cursor-pointer gap-3 text-sm text-[#1A2F4A]">
                <input
                  type="radio"
                  name="tipo"
                  checked={tipo === 'devolucion'}
                  onChange={() => setTipo('devolucion')}
                />
                <span>Devolución (el cliente devuelve y recibe $ de vuelta)</span>
              </label>
              <label className="flex cursor-pointer gap-3 text-sm text-[#1A2F4A]">
                <input type="radio" name="tipo" checked={tipo === 'cambio'} onChange={() => setTipo('cambio')} />
                <span>Cambio (el cliente devuelve un producto y lleva otro)</span>
              </label>
              <div>
                <label className="text-sm font-semibold text-[#1A2F4A]" htmlFor="venta-orig">
                  Venta original (opcional)
                </label>
                <input
                  id="venta-orig"
                  className={inputClass}
                  placeholder="Buscar por N° de venta o nombre de cliente"
                  value={ventaQ}
                  onChange={(e) => {
                    setVenta(null)
                    setVentaQ(e.target.value)
                  }}
                />
                {ventaHits.length > 0 ? (
                  <ul className="mt-1 overflow-hidden rounded-md border border-[#E2E8F0] bg-white">
                    {ventaHits.map((h) => (
                      <li key={h.id}>
                        <button
                          className="block w-full px-3 py-2 text-left text-sm text-[#1A2F4A] hover:bg-[#EEF2F6]"
                          type="button"
                          onClick={() => aplicarVenta(h)}
                        >
                          {h.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-xs text-[#4A5568]">Si no tiene venta registrada, continuá igual.</p>
              </div>
              <button className={btnPrimary} type="button" onClick={siguienteDesde1}>
                Continuar
              </button>
            </div>
          ) : null}

          {paso === 2 ? (
            <div className="mt-5">
              <LineasEditor
                titulo="Productos devueltos (lo que trae el cliente)"
                lineas={devueltos}
                catalogo={catalogo}
                onChange={setDevueltos}
              />
              <p className="mt-3 text-sm font-semibold text-[#1A2F4A]">Total devuelto: {formatoARS(totDev)}</p>
              <div className="mt-4 flex gap-2">
                <button className="h-11 rounded-lg px-4 text-sm font-semibold text-[#6366F1]" type="button" onClick={() => setPaso(1)}>
                  Atrás
                </button>
                <button className={btnPrimary} type="button" onClick={siguienteDesde2}>
                  Continuar
                </button>
              </div>
            </div>
          ) : null}

          {paso === 3 ? (
            <div className="mt-5">
              <LineasEditor
                titulo="Productos entregados (lo que se lleva el cliente)"
                lineas={entregados}
                catalogo={catalogo}
                onChange={setEntregados}
              />
              <p className="mt-3 text-sm font-semibold text-[#1A2F4A]">
                {diff > 0
                  ? `El cliente debe abonar: ${formatoARS(diff)}`
                  : diff < 0
                    ? `Diferencia a favor del cliente: ${formatoARS(-diff)}`
                    : 'Sin diferencia de precio'}
              </p>
              <div className="mt-4 flex gap-2">
                <button className="h-11 rounded-lg px-4 text-sm font-semibold text-[#6366F1]" type="button" onClick={() => setPaso(2)}>
                  Atrás
                </button>
                <button className={btnPrimary} type="button" onClick={siguienteDesde3}>
                  Continuar
                </button>
              </div>
            </div>
          ) : null}

          {paso === 4 ? (
            <div className="mt-5 space-y-4 text-sm text-[#1A2F4A]">
              <p>
                <span className="font-semibold">Tipo:</span> {tipo === 'cambio' ? 'Cambio' : 'Devolución'}
              </p>
              <p>
                <span className="font-semibold">Venta original:</span> {venta?.label ?? 'Sin venta vinculada'}
              </p>
              <div>
                <p className="font-semibold">Devueltos</p>
                <ul className="mt-1 list-disc pl-5">
                  {lineasValidas(devueltos).map((l) => (
                    <li key={l.uid}>
                      {l.nombre} × {l.cantidad} · {formatoARS(l.precioUnitario)}
                    </li>
                  ))}
                </ul>
              </div>
              {tipo === 'cambio' ? (
                <>
                  <div>
                    <p className="font-semibold">Entregados</p>
                    <ul className="mt-1 list-disc pl-5">
                      {lineasValidas(entregados).map((l) => (
                        <li key={l.uid}>
                          {l.nombre} × {l.cantidad} · {formatoARS(l.precioUnitario)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="font-semibold">
                    {diff > 0
                      ? `El cliente debe abonar: ${formatoARS(diff)}`
                      : diff < 0
                        ? `Diferencia a favor del cliente: ${formatoARS(-diff)}`
                        : 'Sin diferencia de precio'}
                  </p>
                </>
              ) : (
                <p>
                  <span className="font-semibold">A devolver al cliente:</span> {formatoARS(totDev)}
                </p>
              )}
              <label className="block">
                Motivo (opcional)
                <select className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  <option value="">Sin motivo</option>
                  {MOTIVOS_DEVOLUCION.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Notas (opcional)
                <textarea
                  className="mt-1.5 min-h-[80px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  className="h-11 rounded-lg px-4 text-sm font-semibold text-[#6366F1]"
                  type="button"
                  onClick={() => setPaso(tipo === 'cambio' ? 3 : 2)}
                >
                  Atrás
                </button>
                <button className={btnPrimary} type="button" disabled={enviando} onClick={() => void confirmar()}>
                  {enviando ? 'Confirmando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <Link className="mt-6 block text-center text-sm text-[#A5B4FC]" to="/ventas?tab=devoluciones">
          Volver al listado
        </Link>
      </div>
    </div>
  )
}
