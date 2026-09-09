import { Link, useParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  BadgeEstado,
  TableCard,
  Th,
  Tr,
  cardShell,
  theadClass,
  theadStyle,
} from '../components/listado'
import { linkWhatsApp } from '../lib/clientes'
import { formatoFechaCompra } from '../lib/compras'
import { formatoARS } from '../lib/productos'
import {
  etiquetaProveedor,
  obtenerFichaProveedor,
  type CompraProveedor,
  type ProveedorFila,
} from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <p className="text-sm text-[#94A3B8]">
      {label}
      <span className="mt-0.5 block text-[#F1F5F9]">{valor?.trim() ? valor : '—'}</span>
    </p>
  )
}

export function ProveedorFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const [fila, setFila] = useState<ProveedorFila | null>(null)
  const [compras, setCompras] = useState<CompraProveedor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const res = await obtenerFichaProveedor(requireSupabase(), id)
    setCargando(false)
    if (res.error || !res.fila) {
      setError(res.error || 'No se encontró el proveedor')
      return
    }
    setError(null)
    setFila(res.fila)
    setCompras(res.compras)
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!perfil) return null

  const wa = linkWhatsApp(fila?.telefono ?? null)
  const titulo = fila ? etiquetaProveedor(fila) : ''
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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 text-white">
        <AppNav />
        <Link className="mb-4 inline-block text-sm font-medium text-[#A5B4FC]" to="/proveedores">
          ← Volver a proveedores
        </Link>

        {cargando ? <p className="text-sm text-[#94A3B8]">Cargando…</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}

        {fila ? (
          <>
            <section className="p-5" style={cardShell}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1
                    className="text-[28px] font-semibold text-[#F1F5F9]"
                    style={{ fontFamily: theme.fontDisplay }}
                  >
                    {titulo}
                  </h1>
                  <div className="mt-2">
                    <BadgeEstado activo={fila.activo} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {puedeEditar ? (
                    <Link
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-[#6366F1]"
                      to={`/proveedores/${fila.id}/editar`}
                      style={{ border: '1px solid rgba(99,102,241,0.4)', background: 'transparent' }}
                    >
                      ✏️ Editar datos
                    </Link>
                  ) : null}
                  {wa ? (
                    <a
                      className="inline-flex h-10 items-center rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white"
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                </div>
              </div>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#A5B4FC]">Datos fiscales</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Dato label="Razón social" valor={fila.razon_social} />
                <Dato label="Nombre comercial" valor={fila.nombre_comercial} />
                <Dato label="CUIT" valor={fila.cuit} />
                <Dato label="Condición AFIP" valor={fila.condicion_afip} />
              </div>

              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-[#A5B4FC]">
                Datos de contacto
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Dato label="Teléfono / WhatsApp" valor={fila.telefono} />
                <Dato label="Email" valor={fila.email} />
                <Dato label="Vendedor / contacto" valor={fila.nombre_vendedor} />
              </div>

              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-[#A5B4FC]">
                Datos comerciales
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Dato label="Productos que provee" valor={fila.productos_que_provee} />
                <Dato label="Condiciones de pago" valor={fila.condiciones_pago} />
                <Dato
                  label="Formas de pago aceptadas"
                  valor={fila.formas_pago_aceptadas.length ? fila.formas_pago_aceptadas.join(', ') : null}
                />
                <Dato label="Plazo de entrega" valor={fila.plazo_entrega} />
              </div>

              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-[#A5B4FC]">
                Datos bancarios
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Dato label="CBU" valor={fila.cbu} />
                <Dato label="Alias CBU" valor={fila.alias_cbu} />
                <Dato label="Banco" valor={fila.banco} />
              </div>

              {fila.notas ? (
                <>
                  <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-[#A5B4FC]">Notas</p>
                  <p className="whitespace-pre-wrap text-sm text-[#F1F5F9]">{fila.notas}</p>
                </>
              ) : null}
            </section>

            <h2
              className="mb-3 mt-8 text-lg font-semibold text-[#F1F5F9]"
              style={{ fontFamily: theme.fontDisplay }}
            >
              Historial de compras
            </h2>
            <TableCard>
              <table className="w-full min-w-[640px] text-left">
                <thead className={theadClass} style={theadStyle}>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Productos</Th>
                    <Th>Total</Th>
                    <Th>Notas</Th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map((c, index) => (
                    <Tr key={c.id} index={index}>
                      <td className="px-3 py-3">{formatoFechaCompra(c.fecha)}</td>
                      <td className="px-3 py-3 text-[#E2E8F0]">{c.productos || '—'}</td>
                      <td className="px-3 py-3 font-semibold text-[#4ADE80]">{formatoARS(c.total)}</td>
                      <td className="px-3 py-3 text-[#94A3B8]">{c.notas ?? '—'}</td>
                    </Tr>
                  ))}
                </tbody>
              </table>
              {compras.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">
                  Todavía no hay compras vinculadas a este proveedor.
                </p>
              ) : null}
            </TableCard>
          </>
        ) : null}
      </div>
    </div>
  )
}
