import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, PageSkeleton, cardShell } from '../components/listado'
import { formatoFechaCompra, obtenerCompra, type CompraFicha } from '../lib/compras'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

export function CompraFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const [ficha, setFicha] = useState<CompraFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ampliar, setAmpliar] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const { data, error: fallo } = await obtenerCompra(requireSupabase(), id)
    setCargando(false)
    if (fallo || !data) {
      setError(fallo ?? 'No se encontró la compra')
      setFicha(null)
      return
    }
    setError(null)
    setFicha(data)
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

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
            { label: 'Compras', to: '/compras' },
            { label: ficha ? formatoFechaCompra(ficha.fecha) : 'Compra' },
          ]}
        />
        {cargando ? <PageSkeleton /> : null}
        {error ? (
          <p className="mt-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {ficha && !cargando ? (
          <div className="mt-6 p-6" style={cardShell}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-[#F1F5F9]">Compra</h1>
              {ficha.totalCostosAdicionales > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  📦 Incluye costos adicionales
                </span>
              ) : null}
              {ficha.anulada ? (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-[#F87171]">
                  Anulada
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#94A3B8]">{formatoFechaCompra(ficha.fecha)}</p>
            {ficha.proveedor ? <p className="mt-1 text-sm text-[#CBD5E1]">🏭 {ficha.proveedor}</p> : null}

            <ul className="mt-4 space-y-2 text-sm text-[#E2E8F0]">
              {ficha.items.map((it, i) => (
                <li key={`${it.nombre}-${i}`} className="flex justify-between gap-2">
                  <span>
                    {it.nombre} × {it.cantidad}
                  </span>
                  <span>{formatoARS(it.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-[rgba(99,102,241,0.2)] bg-white/5 px-4 py-4 text-sm text-[#E2E8F0]">
              <p className="font-semibold text-[#F1F5F9]">Desglose</p>
              <p className="mt-2 flex justify-between">
                <span>Subtotal productos</span>
                <span>{formatoARS(ficha.total)}</span>
              </p>
              {ficha.costoFlete > 0 ? (
                <p className="mt-1 flex justify-between">
                  <span>🚚 Flete / Envío</span>
                  <span>{formatoARS(ficha.costoFlete)}</span>
                </p>
              ) : null}
              {ficha.costoImpuestos > 0 ? (
                <p className="mt-1 flex justify-between">
                  <span>📋 Impuestos / Aranceles</span>
                  <span>{formatoARS(ficha.costoImpuestos)}</span>
                </p>
              ) : null}
              {ficha.costoOtros > 0 ? (
                <p className="mt-1 flex justify-between">
                  <span>📦 Otros{ficha.descripcionOtros ? ` (${ficha.descripcionOtros})` : ''}</span>
                  <span>{formatoARS(ficha.costoOtros)}</span>
                </p>
              ) : null}
              <p className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-bold text-[#F1F5F9]">
                <span>Total real</span>
                <span>{formatoARS(ficha.totalReal)}</span>
              </p>
            </div>

            {ficha.notas ? <p className="mt-4 text-sm text-[#94A3B8]">{ficha.notas}</p> : null}
            {ficha.imagenFacturaUrl ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-[#F1F5F9]">Factura</p>
                <button
                  className="mt-2 block w-full overflow-hidden rounded-xl border border-[rgba(99,102,241,0.2)]"
                  type="button"
                  onClick={() => setAmpliar(true)}
                >
                  <img
                    src={ficha.imagenFacturaUrl}
                    alt="Factura de compra"
                    className="max-h-64 w-full bg-black/30 object-contain"
                  />
                </button>
                <button
                  className="mt-2 inline-block text-sm font-semibold text-[#A5B4FC]"
                  type="button"
                  onClick={() => setAmpliar(true)}
                >
                  Ver ampliada
                </button>
              </div>
            ) : null}
            <Link className="mt-6 inline-block text-sm font-semibold text-[#A5B4FC]" to="/compras">
              Volver al listado
            </Link>
          </div>
        ) : null}
      </div>
      {ampliar && ficha?.imagenFacturaUrl ? (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          type="button"
          onClick={() => setAmpliar(false)}
        >
          <img src={ficha.imagenFacturaUrl} alt="Factura ampliada" className="max-h-full max-w-full object-contain" />
        </button>
      ) : null}
    </div>
  )
}
