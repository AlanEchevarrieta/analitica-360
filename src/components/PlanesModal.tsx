import { CATALOGO_PLANES, linkWhatsAppPlanes } from '../lib/planes'

export function PlanesModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  if (!abierto) return null
  const whatsapp = linkWhatsAppPlanes()

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1A2F4A]">Planes disponibles</h2>
            <p className="mt-1 text-sm text-[#4A5568]">Elegí el que mejor se adapte a tu negocio.</p>
          </div>
          <button className="text-sm font-semibold text-[#4A5568]" type="button" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CATALOGO_PLANES.map((plan) => (
            <div
              key={plan.id}
              className="rounded-lg border p-4"
              style={{
                borderColor: plan.destacado ? '#6366F1' : '#E2E8F0',
                boxShadow: plan.destacado ? '0 0 0 1px #6366F1' : undefined,
              }}
            >
              <p className="text-sm font-bold text-[#1A2F4A]">{plan.titulo}</p>
              <p className="mt-1 text-sm text-[#4A5568]">{plan.precio}</p>
              <ul className="mt-3 space-y-1 text-sm text-[#1A2F4A]">
                {plan.items.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
              {plan.pago ? (
                <a
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contactar para contratar
                </a>
              ) : (
                <p className="mt-4 text-xs text-[#4A5568]">Incluido en el alta de la cuenta.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
