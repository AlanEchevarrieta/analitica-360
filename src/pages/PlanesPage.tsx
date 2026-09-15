import { useState } from 'react'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PlanesModal } from '../components/PlanesModal'
import { PageTitle, btnPrimary } from '../components/listado'
import {
  DESCUENTO_ANUAL,
  MESES_DESCUENTO_LANZAMIENTO,
  MODULOS_COMPARATIVA,
  PLANES,
  PLANES_PAGOS,
  etiquetaPlan,
  formatoPrecioPlan,
  mesesAhorroAnual,
  precioLanzamiento,
  precioLista,
  type CicloFacturacion,
  type PlanPagoId,
} from '../lib/planes'
import { theme } from '../theme'

export function PlanesPage() {
  const { perfil } = useAuth()
  const [ciclo, setCiclo] = useState<CicloFacturacion>('mensual')
  const [elegido, setElegido] = useState<PlanPagoId | null>(null)

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 text-white">
        <AppNav />
        <PageTitle titulo="Planes" subtitulo="Elegí el que mejor se adapte a tu negocio" />

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-lg bg-white/10 p-1">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                ciclo === 'mensual' ? 'bg-[#6366F1] text-white' : 'text-[#A5B4FC]'
              }`}
              onClick={() => setCiclo('mensual')}
            >
              Mensual
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                ciclo === 'anual' ? 'bg-[#6366F1] text-white' : 'text-[#A5B4FC]'
              }`}
              onClick={() => setCiclo('anual')}
            >
              Anual −{Math.round(DESCUENTO_ANUAL * 100)}%
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANES_PAGOS.map((id) => {
            const plan = PLANES[id]
            const lista = precioLista(id, ciclo)
            const lanz = precioLanzamiento(id, ciclo)
            return (
              <article
                key={id}
                className="relative flex flex-col rounded-lg p-5"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: plan.popular ? `2px solid ${plan.color}` : '1px solid rgba(99,102,241,0.2)',
                }}
              >
                {plan.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6366F1] px-3 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    MÁS POPULAR
                  </span>
                ) : null}
                <h2 className="text-lg font-bold" style={{ color: plan.color }}>
                  {id === 'premium' ? '⭐ ' : ''}
                  {plan.nombre}
                </h2>
                <p className="mt-3 text-sm text-[#94A3B8] line-through">{formatoPrecioPlan(lista)}</p>
                <p className="text-2xl font-semibold text-[#F1F5F9]">
                  {formatoPrecioPlan(lanz)}
                  <span className="text-sm font-normal text-[#94A3B8]">/mes</span>
                </p>
                <p className="mt-1 text-xs text-amber-200">
                  🔥 Precio de lanzamiento — primeros {MESES_DESCUENTO_LANZAMIENTO} meses
                </p>
                {ciclo === 'anual' ? (
                  <p className="mt-1 text-xs text-[#A5B4FC]">
                    Ahorrás {mesesAhorroAnual()} meses pagando el año
                  </p>
                ) : null}
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {MODULOS_COMPARATIVA.map((mod) => {
                    const ok = plan.modulos.includes(mod.id)
                    return (
                      <li key={mod.id} className={ok ? 'text-[#F1F5F9]' : 'text-[#64748B]'}>
                        {ok ? '✅' : '❌'} {mod.label}
                      </li>
                    )
                  })}
                </ul>
                <button
                  className={`${btnPrimary} mt-5 w-full`}
                  type="button"
                  onClick={() => setElegido(id)}
                >
                  Elegir plan
                </button>
              </article>
            )
          })}
        </div>
        {perfil ? (
          <p className="mt-6 text-center text-sm text-[#94A3B8]">
            Plan actual: {etiquetaPlan(perfil.empresa.plan_actual)}
          </p>
        ) : null}
      </div>
      <PlanesModal
        abierto={Boolean(elegido)}
        onCerrar={() => setElegido(null)}
        planId={elegido}
        ciclo={ciclo}
      />
    </div>
  )
}
