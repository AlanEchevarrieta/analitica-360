import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ToastHost } from './components/ToastHost'
import { AuthProvider, useAuth } from './auth'
import { ThemeProvider } from './lib/tema'
import { supabase } from './lib/supabase'
import { RequireAuth, RequireCompletarAlta, RequireDueno, RequireGuest } from './routes'

const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const CompletarAltaPage = lazy(() =>
  import('./pages/CompletarAltaPage').then((m) => ({ default: m.CompletarAltaPage })),
)
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)
const PrivacidadPage = lazy(() =>
  import('./pages/PrivacidadPage').then((m) => ({ default: m.PrivacidadPage })),
)
const RegistroPage = lazy(() =>
  import('./pages/RegistroPage').then((m) => ({ default: m.RegistroPage })),
)
const SetupPage = lazy(() => import('./pages/SetupPage').then((m) => ({ default: m.SetupPage })))
const TerminosPage = lazy(() =>
  import('./pages/TerminosPage').then((m) => ({ default: m.TerminosPage })),
)
const ProductosPage = lazy(() =>
  import('./pages/ProductosPage').then((m) => ({ default: m.ProductosPage })),
)
const ProductoFormPage = lazy(() =>
  import('./pages/ProductoFormPage').then((m) => ({ default: m.ProductoFormPage })),
)
const VentasPage = lazy(() => import('./pages/VentasPage').then((m) => ({ default: m.VentasPage })))
const VentaNuevaPage = lazy(() =>
  import('./pages/VentaNuevaPage').then((m) => ({ default: m.VentaNuevaPage })),
)
const ComprasPage = lazy(() => import('./pages/ComprasPage').then((m) => ({ default: m.ComprasPage })))
const CompraNuevaPage = lazy(() =>
  import('./pages/CompraNuevaPage').then((m) => ({ default: m.CompraNuevaPage })),
)
const ClientesPage = lazy(() =>
  import('./pages/ClientesPage').then((m) => ({ default: m.ClientesPage })),
)
const ClienteFormPage = lazy(() =>
  import('./pages/ClienteFormPage').then((m) => ({ default: m.ClienteFormPage })),
)
const ClienteFichaPage = lazy(() =>
  import('./pages/ClienteFichaPage').then((m) => ({ default: m.ClienteFichaPage })),
)
const ConfiguracionPage = lazy(() =>
  import('./pages/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })),
)
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
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
        <Route path="/" element={<HomePage />} />
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/productos/nuevo" element={<ProductoFormPage />} />
        <Route path="/productos/:id" element={<ProductoFormPage />} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/ventas/nueva" element={<VentaNuevaPage />} />
        <Route path="/compras" element={<ComprasPage />} />
        <Route path="/compras/nueva" element={<CompraNuevaPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteFichaPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
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
  useEffect(() => {
    document.title = 'Analítica 360'
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <RecoveryGate />
          <ToastHost />
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
