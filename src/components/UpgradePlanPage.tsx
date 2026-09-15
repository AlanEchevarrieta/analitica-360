import { Link } from 'react-router-dom'
import { AppNav } from './AppNav'
import { ParticleNetwork } from './ParticleNetwork'
import {
  etiquetaModuloPlan,
  formatoPrecioPlan,
  linkWhatsAppPlanes,
  MESES_DESCUENTO_LANZAMIENTO,
  PLANES,
  planMinimoParaModulo,
  precioLanzamiento,
} from '../lib/planes'
import { theme } from '../theme'
import { btnPrimary } from './listado'

export function UpgradePlanPage({ modulo }: { modulo: string }) {
  const planId = planMinimoParaModulo(modulo)
  const plan = PLANES[planId]
  const precio = precioLanzamiento(planId, 'mensual')
  const wa = linkWhatsAppPlanes(plan.nombre)

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
        <div className="rounded-lg bg-white/95 p-6 text-center text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <p className="text-4xl" aria-hidden>
            🔒
          </p>
          <h1 className="mt-3 text-lg font-bold">Esta función es parte del plan {plan.nombre}</h1>
          <p className="mt-2 text-sm text-[#4A5568]">Actualizá para acceder a {etiquetaModuloPlan(modulo)}</p>
          <p className="mt-4 text-base font-semibold text-[#6366F1]">
            {formatoPrecioPlan(precio)}/mes los primeros {MESES_DESCUENTO_LANZAMIENTO} meses
          </p>
          <Link className={`${btnPrimary} mt-6 w-full`} to="/planes">
            Ver todos los planes
          </Link>
          <a
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-[#E2E8F0] px-4 text-sm font-semibold text-[#4A5568]"
            href={wa}
            target="_blank"
            rel="noreferrer"
          >
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
