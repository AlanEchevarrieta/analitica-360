import { useEffect } from 'react'
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

const PLANES: {
  nombre: string
  precio: string
  items: string[]
  cta: string
  destacado?: boolean
  whatsapp?: boolean
}[] = [
  {
    nombre: 'Starter',
    precio: 'Gratis',
    items: ['14 días de prueba', '1 usuario', 'Hasta 50 productos', 'Dashboard básico'],
    cta: 'Empezar gratis',
  },
  {
    nombre: 'Básico',
    precio: '$15.000 ARS/mes',
    items: ['Todo el Starter', 'Hasta 3 usuarios', 'Hasta 200 productos', 'Ventas, Compras, Clientes'],
    cta: 'Empezar gratis',
  },
  {
    nombre: 'Pro',
    precio: '$35.000 ARS/mes',
    items: [
      'Todo el Básico',
      'Usuarios ilimitados',
      'Productos ilimitados',
      'Analytics avanzado',
      'Exportación Excel/PDF',
    ],
    cta: 'Empezar gratis',
    destacado: true,
  },
  {
    nombre: 'Premium',
    precio: '$70.000 ARS/mes',
    items: ['Todo el Pro', 'Soporte prioritario', 'Reportes personalizados'],
    cta: 'Contactar',
    whatsapp: true,
  },
]

function irDemo() {
  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingPage() {
  const wa = linkWhatsAppPlanes()

  useEffect(() => {
    const nodos = [...document.querySelectorAll<HTMLElement>('.landing-chip')]
    if (nodos.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      for (const n of nodos) n.classList.add('in')
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            obs.unobserve(e.target)
          }
        }
      },
      { threshold: 0.2 },
    )
    for (const n of nodos) obs.observe(n)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="landing">
      <ParticleNetwork enableMobile startWhenIdle desktopCount={100} mobileCount={60} />
      <div className="relative z-10">
        <header className="landing-nav sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" className="shrink-0 text-base font-semibold tracking-tight md:text-lg">
            Analítica 360
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden md:inline-flex">
              <ThemeToggle />
            </span>
            <Link to="/login" className="landing-nav-login hidden md:inline-flex">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="landing-nav-cta">
              Crear cuenta
            </Link>
          </div>
        </header>

        <section className="landing-hero flex min-h-0 items-center justify-center px-5 py-10 md:py-14">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <p className="landing-display text-3xl font-bold md:text-5xl">Analítica 360</p>
            <h1 className="landing-display landing-tagline mt-4 font-semibold leading-tight">
              El sistema de gestión que tu negocio necesita
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed opacity-80 md:text-base">
              Registrá ventas, controlá tu stock y conocé tus clientes — desde el celular, en tiempo real.
            </p>
            <div className="mt-6 flex w-full max-w-lg flex-col gap-3 md:flex-row md:justify-center">
              <Link
                to="/registro"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-[#6366F1] px-6 text-base font-semibold text-white hover:bg-[#4F46E5]"
              >
                Empezar gratis 14 días
              </Link>
              <button
                type="button"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-md border border-[#6366F1] px-6 text-base font-semibold hover:bg-[#6366F1]/15"
                onClick={irDemo}
              >
                Ver demo
              </button>
            </div>
            <p className="mt-4 rounded-full bg-black/20 px-4 py-1.5 text-xs opacity-80 md:text-sm">
              Sin tarjeta de crédito · Cancelá cuando quieras
            </p>
          </div>
        </section>

        <section id="demo" className="landing-section px-5 py-12">
          <h2 className="landing-display text-center text-3xl font-semibold md:text-4xl">
            Todo lo que necesita tu negocio
          </h2>
          <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.titulo} className="landing-card rounded-[12px] p-5">
                <p className="flex h-8 w-8 items-center justify-center text-[32px] leading-none" aria-hidden>
                  {f.icon}
                </p>
                <h3 className="landing-display mt-2 text-lg font-semibold">{f.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{f.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section px-5 py-12">
          <h2 className="landing-display text-center text-3xl font-semibold md:text-4xl">
            Planes simples y transparentes
          </h2>
          <p className="mt-2 text-center text-[var(--text-muted)]">Empezá gratis, pagá cuando estés listo</p>
          <div className="landing-planes mx-auto mt-10 grid max-w-6xl grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANES.map((plan) => (
              <article
                key={plan.nombre}
                className={`landing-card flex flex-col rounded-[12px] p-5 ${plan.destacado ? 'landing-card-pro' : ''}`}
              >
                {plan.destacado ? (
                  <span className="landing-popular">MÁS POPULAR</span>
                ) : null}
                <h3 className="landing-display text-xl font-semibold">{plan.nombre}</h3>
                <p className="landing-precio mt-2 font-bold">{plan.precio}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--text-muted)]">
                  {plan.items.map((item) => (
                    <li key={item} className="landing-plan-item">
                      {item}
                    </li>
                  ))}
                </ul>
                {plan.whatsapp ? (
                  <a href={wa} target="_blank" rel="noreferrer" className="landing-plan-btn mt-5">
                    {plan.cta}
                  </a>
                ) : (
                  <Link to="/registro" className="landing-plan-btn mt-5">
                    {plan.cta}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section px-5 py-12">
          <h2 className="landing-display text-center text-3xl font-semibold md:text-4xl">
            Para cualquier tipo de negocio
          </h2>
          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
            {RUBROS.map((r, i) => (
              <span key={r} className="landing-chip" style={{ transitionDelay: `${i * 70}ms` }}>
                {r}
              </span>
            ))}
            <span className="landing-chip" style={{ transitionDelay: `${RUBROS.length * 70}ms` }}>
              y muchos más...
            </span>
          </div>
        </section>

        <section className="landing-cta px-5 py-12 text-center">
          <h2 className="landing-display text-3xl font-semibold text-white md:text-4xl">
            ¿Listo para ordenar tu negocio?
          </h2>
          <p className="mt-3 text-indigo-100">Empezá hoy, gratis, sin compromisos</p>
          <Link
            to="/registro"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-base font-semibold text-[#312E81] hover:bg-indigo-50"
          >
            Crear mi cuenta gratis
          </Link>
        </section>

        <footer className="landing-footer px-5 py-4">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center text-sm lg:flex-row lg:justify-between lg:text-left">
            <p className="shrink-0 font-semibold">Analítica 360</p>
            <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              <Link to="/login">Iniciar sesión</Link>
              <Link to="/registro">Crear cuenta</Link>
              <Link to="/terminos">Términos y condiciones</Link>
              <Link to="/privacidad">Política de privacidad</Link>
            </nav>
            <p className="shrink-0 text-xs text-[#94A3B8]">© 2026 Analítica 360 · Mendoza, Argentina</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
