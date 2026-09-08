import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { supabase } from './lib/supabase'
import { AdminPage } from './pages/AdminPage'
import { CompletarAltaPage } from './pages/CompletarAltaPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PrivacidadPage } from './pages/PrivacidadPage'
import { RegistroPage } from './pages/RegistroPage'
import { SetupPage } from './pages/SetupPage'
import { TerminosPage } from './pages/TerminosPage'
import { ProductosPage } from './pages/ProductosPage'
import { ProductoFormPage } from './pages/ProductoFormPage'
import { VentasPage } from './pages/VentasPage'
import { VentaNuevaPage } from './pages/VentaNuevaPage'
import { ComprasPage } from './pages/ComprasPage'
import { CompraNuevaPage } from './pages/CompraNuevaPage'
import { ClientesPage } from './pages/ClientesPage'
import { ClienteFormPage } from './pages/ClienteFormPage'
import { ClienteFichaPage } from './pages/ClienteFichaPage'
import { ConfiguracionPage } from './pages/ConfiguracionPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { RequireAuth, RequireCompletarAlta, RequireDueno, RequireGuest } from './routes'

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
      <AuthProvider>
        <RecoveryGate />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
