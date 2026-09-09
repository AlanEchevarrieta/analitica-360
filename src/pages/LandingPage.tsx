import { Link } from 'react-router-dom'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { ThemeToggle } from '../lib/tema'
import { linkWhatsAppPlanes } from '../lib/planes'

const FEATURES = [
  {
    icon: '💸',
    titulo: 'Ventas en segundos',
    texto: 'Registrá una venta con múltiples productos, descuentos y cuotas en menos de 30 segundos',
  },
  {
    icon: '📦',
    titulo: 'Stock siempre actualizado',
    texto: 'Cada venta y compra actualiza el stock automáticamente. Nunca más quedarte sin saber cuánto tenés',
  },
  {
    icon: '👥',
    titulo: 'Conocé a tus clientes',
    texto: 'Guardá el historial de cada cliente, sus preferencias y cuándo es su cumpleaños',
  },
  {
    icon: '📊',
    titulo: 'Dashboard en tiempo real',
    texto: 'Mirá cuánto vendiste hoy, esta semana y este mes. Gráficos claros sin complicaciones',
  },
  {
    icon: '🏭',
    titulo: 'Proveedores y compras',
    texto: 'Registrá tus compras, controlá tus costos y calculá tu margen de ganancia real',
  },
  {
    icon: '📱',
    titulo: 'Desde el celular',
    texto: 'Diseñado para usarse en la feria, el local o donde estés — funciona en cualquier dispositivo',
  },
]

const RUBROS = [
  'Indumentaria',
  'Ferretería',
  'Gastronomía',
  'Veterinaria',
  'Librería',
  'Cosméticos',
  'Electrónica',
  'Artesanías',
  'Farmacia',
  'Peluquería',
  'Vivero',
  'Joyería',
]

function irDemo() {
  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingPage() {
  const wa = linkWhatsAppPlanes()

  return (
    <div className="landing">
      <header className="landing-nav sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link to="/" className="shrink-0 text-base font-semibold tracking-tight md:text-lg">
          Analítica 360
        </Link>
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Link to="/login" className="hidden text-sm font-medium opacity-80 hover:opacity-100 sm:inline">
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="rounded-md bg-[#6366F1] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4F46E5] md:px-4"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="landing-hero relative min-h-[calc(100dvh-56px)] overflow-hidden">
        <ParticleNetwork contained />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pb-16 pt-10 text-center md:pt-20">
          <p className="landing-display text-4xl font-bold md:text-6xl">Analítica 360</p>
          <h1 className="landing-display mt-6 text-2xl font-semibold leading-tight md:text-4xl">
            El sistema de gestión que tu negocio necesita
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-80 md:text-lg">
            Registrá ventas, controlá tu stock y conocé tus clientes — desde el celular, en tiempo real.
          </p>
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/registro"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[#6366F1] px-6 text-base font-semibold text-white hover:bg-[#4F46E5]"
            >
              Empezar gratis 14 días
            </Link>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-md border border-[#6366F1] px-6 text-base font-semibold hover:bg-[#6366F1]/15"
              onClick={irDemo}
            >
              Ver demo
            </button>
          </div>
          <p className="mt-5 rounded-full bg-black/20 px-4 py-1.5 text-xs opacity-80 md:text-sm">
            Sin tarjeta de crédito · Cancelá cuando quieras
          </p>
          <Link to="/login" className="mt-6 text-sm font-medium text-[#6366F1] underline sm:hidden">
            Iniciar sesión
          </Link>
        </div>
      </section>

      <section id="demo" className="landing-section px-5 py-16 md:py-24">
        <h2 className="landing-display text-center text-3xl font-semibold md:text-4xl">
          Todo lo que necesita tu negocio
        </h2>
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.titulo} className="landing-card rounded-xl p-5">
              <p className="text-2xl" aria-hidden>
                {f.icon}
              </p>
              <h3 className="landing-display mt-3 text-xl font-semibold">{f.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{f.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section px-5 py-16 md:py-24">
        <h2 className="landing-display text-center text-3xl font-semibold md:text-4xl">
          Planes simples y transparentes
        </h2>
        <p className="mt-3 text-center text-[var(--text-muted)]">Empezá gratis, pagá cuando estés listo</p>
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="landing-card flex flex-col rounded-xl p-5">
            <h3 className="landing-display text-xl font-semibold">Starter</h3>
            <p className="mt-1 text-2xl font-bold">Gratis</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--text-muted)]">
              <li>14 días de prueba</li>
              <li>1 usuario</li>
              <li>Hasta 50 productos</li>
              <li>Dashboard básico</li>
            </ul>
            <Link to="/registro" className="landing-plan-btn mt-6">
              Empezar gratis
            </Link>
          </article>

          <article className="landing-card flex flex-col rounded-xl p-5">
            <h3 className="landing-display text-xl font-semibold">Básico</h3>
            <p className="mt-1 text-2xl font-bold">$15.000 ARS/mes</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Todo el Starter</li>
              <li>Hasta 3 usuarios</li>
              <li>Hasta 200 productos</li>
              <li>Ventas, Compras, Clientes</li>
            </ul>
            <Link to="/registro" className="landing-plan-btn mt-6">
              Empezar gratis
            </Link>
          </article>

          <article className="landing-card landing-card-pro relative flex flex-col rounded-xl p-5">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6366F1] px-3 py-0.5 text-[11px] font-bold tracking-wide text-white">
              MÁS POPULAR
            </span>
            <h3 className="landing-display text-xl font-semibold">Pro</h3>
            <p className="mt-1 text-2xl font-bold">$35.000 ARS/mes</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Todo el Básico</li>
              <li>Usuarios ilimitados</li>
              <li>Productos ilimitados</li>
              <li>Analytics avanzado</li>
              <li>Exportación Excel/PDF</li>
            </ul>
            <Link to="/registro" className="landing-plan-btn mt-6">
              Empezar gratis
            </Link>
          </article>

          <article className="landing-card flex flex-col rounded-xl p-5">
            <h3 className="landing-display text-xl font-semibold">Premium</h3>
            <p className="mt-1 text-2xl font-bold">$70.000 ARS/mes</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Todo el Pro</li>
              <li>Soporte prioritario</li>
              <li>Reportes personalizados</li>
            </ul>
            <a href={wa} target="_blank" rel="noreferrer" className="landing-plan-btn mt-6">
              Contactar
            </a>
          </article>
        </div>
      </section>

      <section className="landing-section px-5 py-16 md:py-24">
        <h2 className="landing-display text-center text-3xl font-semibold md:text-4xl">
          Para cualquier tipo de negocio
        </h2>
        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2">
          {RUBROS.map((r) => (
            <span key={r} className="landing-chip">
              {r}
            </span>
          ))}
          <span className="landing-chip">y muchos más...</span>
        </div>
      </section>

      <section className="landing-cta px-5 py-16 text-center md:py-24">
        <h2 className="landing-display text-3xl font-semibold text-white md:text-4xl">
          ¿Listo para ordenar tu negocio?
        </h2>
        <p className="mt-3 text-indigo-100">Empezá hoy, gratis, sin compromisos</p>
        <Link
          to="/registro"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-base font-semibold text-[#312E81] hover:bg-indigo-50"
        >
          Crear mi cuenta gratis
        </Link>
      </section>

      <footer className="landing-footer px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="font-semibold">Analítica 360</p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/registro">Crear cuenta</Link>
            <Link to="/terminos">Términos y condiciones</Link>
            <Link to="/privacidad">Política de privacidad</Link>
          </nav>
        </div>
        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          © 2026 Analítica 360 · Mendoza, Argentina
        </p>
      </footer>
    </div>
  )
}
