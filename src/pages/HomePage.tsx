import { useAuth } from '../auth'

export function HomePage() {
  const { perfil, cerrarSesion, error } = useAuth()
  if (!perfil) return null

  const rolLabel =
    perfil.usuario.rol === 'dueno'
      ? 'Dueño'
      : perfil.usuario.rol === 'operador'
        ? 'Operador'
        : 'Visor'

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#8a7a63]">Analítica 360</p>
          <h1 className="text-xl font-bold text-[#3E2716]">{perfil.empresa.nombre}</h1>
        </div>
        <button
          className="rounded-lg border border-[#c9a88a] px-3 py-2 text-xs font-semibold text-[#5C3A21]"
          type="button"
          onClick={() => void cerrarSesion()}
        >
          Cerrar sesión
        </button>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-xl border border-[rgba(92,58,33,0.12)] bg-[#FFFDF8] p-4">
        <p className="text-sm text-[#4a3d30]">
          Hola, <strong>{perfil.usuario.nombre}</strong>
        </p>
        <p className="mt-1 text-sm text-[#4a3d30]">{perfil.usuario.email}</p>
        <p className="mt-1 text-sm text-[#4a3d30]">
          Rol: <strong>{rolLabel}</strong> · Plan {perfil.empresa.plan_actual}
        </p>
        {perfil.empresa.rubro ? (
          <p className="mt-1 text-sm text-[#4a3d30]">Rubro: {perfil.empresa.rubro}</p>
        ) : null}
      </section>

      <p className="mt-6 text-sm leading-relaxed text-[#8a7a63]">
        Módulo 1 listo: registro, ingreso y cierre de sesión. El siguiente es productos y
        precios. Todavía no hay ventas.
      </p>
    </div>
  )
}
