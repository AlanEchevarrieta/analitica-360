import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  BadgePago,
  IconBtn,
  PageTitle,
  TableCard,
  Th,
  Tr,
  btnPrimary,
  theadClass,
  theadStyle,
} from '../components/listado'
import { formatoARS } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import {
  anularVenta,
  formatoFechaVenta,
  listarVentas,
  resumenVentasHoy,
  type VentaFila,
} from '../lib/ventas'
import { theme } from '../theme'

function etiquetaCuotas(n: number) {
  if (n <= 1) return 'Contado'
  return `${n} cuotas`
}

export function VentasPage() {
  const { perfil, cerrarSesion } = useAuth()
  const [filas, setFilas] = useState<VentaFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [anulando, setAnulando] = useState<string | null>(null)
  const [hoy, setHoy] = useState({ cantidad: 0, total: 0 })

  const cargar = useCallback(async () => {
    setCargando(true)
    const client = requireSupabase()
    const [{ filas: data, error: listError }, resumen] = await Promise.all([
      listarVentas(client),
      resumenVentasHoy(client),
    ])
    setCargando(false)
    setHoy(resumen)
    if (listError) {
      setError('No se pudieron cargar las ventas. Corré supabase/007_ventas.sql en el SQL Editor.')
      return
    }
    setError(null)
    setFilas(data)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const subtitulo = useMemo(
    () => `${hoy.cantidad} ${hoy.cantidad === 1 ? 'venta' : 'ventas'} hoy · ${formatoARS(hoy.total)} total hoy`,
    [hoy],
  )

  if (!perfil) return null

  const puedeAnular = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'anular_ventas')

  async function onAnular(id: string) {
    setError(null)
    setAnulando(id)
    const fallo = await anularVenta(requireSupabase(), id)
    setAnulando(null)
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
          titulo="Ventas"
          subtitulo={subtitulo}
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

        <div className="mb-6 flex justify-end">
          <Link className={btnPrimary} to="/ventas/nueva">
            Nueva venta
          </Link>
        </div>

        {error ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <table className="w-full min-w-[860px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Fecha</Th>
                <Th>Productos</Th>
                <Th>Total</Th>
                <Th>Forma de pago</Th>
                <Th>Cuotas</Th>
                <Th>Cliente</Th>
                {puedeAnular ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 whitespace-nowrap text-[#E2E8F0]">{formatoFechaVenta(fila.fecha)}</td>
                  <td className="px-3 py-3">{fila.productos || '—'}</td>
                  <td className="px-3 py-3 font-bold text-[#4ADE80]">{formatoARS(fila.total)}</td>
                  <td className="px-3 py-3">
                    <BadgePago forma={fila.forma_pago} />
                  </td>
                  <td className="px-3 py-3 text-[#E2E8F0]">{etiquetaCuotas(fila.cuotas)}</td>
                  <td className="px-3 py-3">
                    {fila.cliente ? (
                      <span>👤 {fila.cliente}</span>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  {puedeAnular ? (
                    <td className="px-3 py-3">
                      <IconBtn
                        label="Anular venta"
                        hoverOnly
                        onClick={() => void onAnular(fila.id)}
                      >
                        {anulando === fila.id ? '…' : '🗑️'}
                      </IconBtn>
                    </td>
                  ) : null}
                </Tr>
              ))}
            </tbody>
          </table>
          {!cargando && filas.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">Todavía no hay ventas.</p>
          ) : null}
        </TableCard>
      </div>
    </div>
  )
}
