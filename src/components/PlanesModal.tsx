import { linkWhatsAppPlanes, PLANES, type CicloFacturacion, type PlanPagoId } from '../lib/planes'
import { btnPrimary } from './listado'

export function PlanesModal({
  abierto,
  onCerrar,
  planId,
  ciclo,
}: {
  abierto: boolean
  onCerrar: () => void
  planId?: PlanPagoId | null
  ciclo?: CicloFacturacion
}) {
  if (!abierto) return null
  const plan = planId ? PLANES[planId] : null
  const whatsapp = linkWhatsAppPlanes(plan?.nombre)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1A2F4A]">
              {plan ? `Activar ${plan.nombre}` : 'Planes disponibles'}
            </h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              {plan
                ? `Escribinos por WhatsApp para contratar${ciclo === 'anual' ? ' el pago anual' : ''}.`
                : 'Elegí el que mejor se adapte a tu negocio.'}
            </p>
          </div>
          <button className="text-sm font-semibold text-[#4A5568]" type="button" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        <a
          className={`${btnPrimary} w-full`}
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
        >
          Contactar por WhatsApp
        </a>
      </div>
    </div>
  )
}
