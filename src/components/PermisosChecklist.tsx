import {
  ACCIONES_EQUIPO,
  MODULOS_EQUIPO,
  accesoSoloPedidos,
  accesoSoloVentas,
  accesoTotal,
  type AccesoColaborador,
  type AccionClave,
  type ModuloClave,
  type PresetPermiso,
} from '../lib/permisos'

export function PermisosChecklist({
  acceso,
  onChange,
  preset,
  onPreset,
}: {
  acceso: AccesoColaborador
  onChange: (next: AccesoColaborador) => void
  preset: PresetPermiso
  onPreset: (id: PresetPermiso) => void
}) {
  function toggleModulo(id: ModuloClave) {
    if (id === 'configuracion') return
    onPreset('personalizado')
    onChange({
      ...acceso,
      modulos: { ...acceso.modulos, [id]: !acceso.modulos[id] },
    })
  }

  function toggleAccion(id: AccionClave) {
    onPreset('personalizado')
    onChange({
      ...acceso,
      acciones: { ...acceso.acciones, [id]: !acceso.acciones[id] },
    })
  }

  const btn =
    'h-9 rounded-lg border px-3 text-xs font-semibold'
  const btnOn = `${btn} border-[#6366F1] bg-[rgba(99,102,241,0.2)] text-[#F1F5F9]`
  const btnOff = `${btn} border-[rgba(99,102,241,0.25)] text-[#A5B4FC]`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          className={preset === 'completo' ? btnOn : btnOff}
          type="button"
          onClick={() => {
            onPreset('completo')
            onChange(accesoTotal(false))
          }}
        >
          Acceso completo
        </button>
        <button
          className={preset === 'pedidos' ? btnOn : btnOff}
          type="button"
          onClick={() => {
            onPreset('pedidos')
            onChange(accesoSoloPedidos())
          }}
        >
          Solo pedidos
        </button>
        <button
          className={preset === 'ventas' ? btnOn : btnOff}
          type="button"
          onClick={() => {
            onPreset('ventas')
            onChange(accesoSoloVentas())
          }}
        >
          Solo ventas
        </button>
        <button
          className={preset === 'personalizado' ? btnOn : btnOff}
          type="button"
          onClick={() => onPreset('personalizado')}
        >
          Personalizado
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-[#F1F5F9]">¿Qué módulos puede ver?</p>
        <ul className="mt-2 space-y-1.5">
          {MODULOS_EQUIPO.filter((m) => !m.soloDueno).map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#E2E8F0]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#6366F1]"
                  checked={Boolean(acceso.modulos[m.id])}
                  onChange={() => toggleModulo(m.id)}
                />
                <span>
                  {m.icono} {m.label}
                </span>
              </label>
            </li>
          ))}
          <li className="text-xs text-[#94A3B8]">⚙️ Configuración (solo dueño)</li>
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium text-[#F1F5F9]">¿Qué puede hacer?</p>
        <ul className="mt-2 space-y-1.5">
          {ACCIONES_EQUIPO.map((a) => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#E2E8F0]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#6366F1]"
                  checked={Boolean(acceso.acciones[a.id])}
                  onChange={() => toggleAccion(a.id)}
                />
                {a.label}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
