import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { supabase } from './lib/supabase'
import { CompletarAltaPage } from './pages/CompletarAltaPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RegistroPage } from './pages/RegistroPage'
import { SetupPage } from './pages/SetupPage'
import { RequireAuth, RequireCompletarAlta, RequireGuest } from './routes'

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
  if (!configurado) return <SetupPage />

  return (
    <Routes>
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
