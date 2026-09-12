import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ToastHost } from './components/ToastHost'
import { AuthProvider, useAuth } from './auth'
import { ThemeProvider } from './lib/tema'
import { supabase } from './lib/supabase'
import { RequireAuth, RequireCompletarAlta, RequireDueno, RequireGuest } from './routes'

function loadComponent(importFn: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    importFn().catch(() => {
      window.location.reload()
      return { default: () => null }
    }),
  )
}

const LandingPage = loadComponent(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)

const AdminPage = loadComponent(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const CompletarAltaPage = loadComponent(() =>
  import('./pages/CompletarAltaPage').then((m) => ({ default: m.CompletarAltaPage })),
)
const HomePage = loadComponent(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const InventarioPage = loadComponent(() =>
  import('./pages/InventarioPage').then((m) => ({ default: m.InventarioPage })),
)
const LoginPage = loadComponent(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ResetPasswordPage = loadComponent(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)
const PrivacidadPage = loadComponent(() =>
  import('./pages/PrivacidadPage').then((m) => ({ default: m.PrivacidadPage })),
)
const RegistroPage = loadComponent(() =>
  import('./pages/RegistroPage').then((m) => ({ default: m.RegistroPage })),
)
const SetupPage = loadComponent(() => import('./pages/SetupPage').then((m) => ({ default: m.SetupPage })))
const TerminosPage = loadComponent(() =>
  import('./pages/TerminosPage').then((m) => ({ default: m.TerminosPage })),
)
const ProductosPage = loadComponent(() =>
  import('./pages/ProductosPage').then((m) => ({ default: m.ProductosPage })),
)
const ProductoFormPage = loadComponent(() =>
  import('./pages/ProductoFormPage').then((m) => ({ default: m.ProductoFormPage })),
)
const VentasPage = loadComponent(() => import('./pages/VentasPage').then((m) => ({ default: m.VentasPage })))
const VentaNuevaPage = loadComponent(() =>
  import('./pages/VentaNuevaPage').then((m) => ({ default: m.VentaNuevaPage })),
)
const ComprasPage = loadComponent(() => import('./pages/ComprasPage').then((m) => ({ default: m.ComprasPage })))
const CompraNuevaPage = loadComponent(() =>
  import('./pages/CompraNuevaPage').then((m) => ({ default: m.CompraNuevaPage })),
)
const ProveedoresPage = loadComponent(() =>
  import('./pages/ProveedoresPage').then((m) => ({ default: m.ProveedoresPage })),
)
const ProveedorFormPage = loadComponent(() =>
  import('./pages/ProveedorFormPage').then((m) => ({ default: m.ProveedorFormPage })),
)
const ProveedorFichaPage = loadComponent(() =>
  import('./pages/ProveedorFichaPage').then((m) => ({ default: m.ProveedorFichaPage })),
)
const ClientesPage = loadComponent(() =>
  import('./pages/ClientesPage').then((m) => ({ default: m.ClientesPage })),
)
const ClienteFormPage = loadComponent(() =>
  import('./pages/ClienteFormPage').then((m) => ({ default: m.ClienteFormPage })),
)
const ClienteFichaPage = loadComponent(() =>
  import('./pages/ClienteFichaPage').then((m) => ({ default: m.ClienteFichaPage })),
)
const ConfiguracionPage = loadComponent(() =>
  import('./pages/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })),
)
const AnalyticsPage = loadComponent(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const InsightsPage = loadComponent(() =>
  import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
)
const SoportePage = loadComponent(() =>
  import('./pages/SoportePage').then((m) => ({ default: m.SoportePage })),
)
const SoporteNuevoPage = loadComponent(() =>
  import('./pages/SoporteNuevoPage').then((m) => ({ default: m.SoporteNuevoPage })),
)
const SoporteFichaPage = loadComponent(() =>
  import('./pages/SoporteFichaPage').then((m) => ({ default: m.SoporteFichaPage })),
)

function PageFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#080C14',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(99,102,241,0.3)',
          borderTop: '3px solid #6366F1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
    </div>
  )
}

function RecoveryGate() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && location.pathname !== '/reset-password') {
        navigate('/reset-password', { replace: true })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [navigate, location.pathname])

  return null
}

const INACTIVIDAD_MS = 8 * 60 * 60 * 1000

function InactivityWatch() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session || !supabase) return

    let timer = 0
    let expirando = false

    function programar() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (expirando) return
        expirando = true
        void (async () => {
          await supabase?.auth.signOut()
          navigate('/login?inactividad=1', { replace: true })
        })()
      }, INACTIVIDAD_MS)
    }

    programar()
    const onActividad = () => programar()
    document.addEventListener('click', onActividad, true)
    document.addEventListener('keydown', onActividad, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', onActividad, true)
      document.removeEventListener('keydown', onActividad, true)
    }
  }, [session, navigate])

  return null
}

function TitleGate() {
  const location = useLocation()
  useEffect(() => {
    document.title =
      location.pathname === '/'
        ? 'Analítica 360 — Sistema de gestión para comercios'
        : 'Analítica 360'
  }, [location.pathname])
  return null
}

function PublicHome() {
  const { listo, session, perfil } = useAuth()
  if (listo && session && !perfil) return <Navigate to="/completar-alta" replace />
  if (listo && session && perfil) return <Navigate to="/inicio" replace />
  return <LandingPage />
}

function AppRoutes() {
  const { configurado } = useAuth()
  if (!configurado) {
    return (
      <Routes>
        <Route path="/terminos" element={<TerminosPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="*" element={<SetupPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/privacidad" element={<PrivacidadPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
      </Route>
      <Route element={<RequireCompletarAlta />}>
        <Route path="/completar-alta" element={<CompletarAltaPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/inicio" element={<HomePage />} />
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/productos/nuevo" element={<ProductoFormPage />} />
        <Route path="/productos/:id" element={<ProductoFormPage />} />
        <Route path="/inventario" element={<InventarioPage />} />
        <Route path="/soporte" element={<SoportePage />} />
        <Route path="/soporte/nuevo" element={<SoporteNuevoPage />} />
        <Route path="/soporte/:id" element={<SoporteFichaPage />} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/ventas/nueva" element={<VentaNuevaPage />} />
        <Route path="/compras" element={<ComprasPage />} />
        <Route path="/compras/nueva" element={<CompraNuevaPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="/proveedores/nuevo" element={<ProveedorFormPage />} />
        <Route path="/proveedores/:id/editar" element={<ProveedorFormPage />} />
        <Route path="/proveedores/:id" element={<ProveedorFichaPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteFichaPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route element={<RequireDueno />}>
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <RecoveryGate />
          <TitleGate />
          <InactivityWatch />
          <ToastHost />
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
