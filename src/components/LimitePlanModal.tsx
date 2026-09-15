import { Link } from 'react-router-dom'
import { btnPrimary } from './listado'

export function LimitePlanModal({
  abierto,
  titulo,
  texto,
  onCerrar,
}: {
  abierto: boolean
  titulo: string
  texto: string
  onCerrar: () => void
}) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
      <div className="w-full max-w-md rounded-lg bg-white p-5 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h3 className="text-lg font-bold">{titulo}</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#4A5568]">{texto}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link className={`${btnPrimary} flex-1`} to="/planes" onClick={onCerrar}>
            Ver planes
          </Link>
          <button
            className="h-11 rounded-lg border border-[#E2E8F0] px-4 text-sm font-semibold text-[#4A5568]"
            type="button"
            onClick={onCerrar}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
