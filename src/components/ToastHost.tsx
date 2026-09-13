import { useEffect, useState } from 'react'
import { MSG_SESION_EXPIRADA, suscribirToast, type ToastTipo } from '../lib/consulta'

const TOAST_BG: Record<ToastTipo, string> = {
  info: '#6366F1',
  ok: '#16A34A',
  warn: '#D97706',
  error: '#F87171',
}

export function ToastHost() {
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [tipo, setTipo] = useState<ToastTipo>('info')

  useEffect(() => {
    return suscribirToast((texto, t) => {
      setTipo(t)
      setMensaje(texto)
      window.setTimeout(() => setMensaje(null), 3500)
    })
  }, [])

  if (!mensaje) return null
  return (
    <div className="toast-sesion" role="status" style={{ background: TOAST_BG[tipo] }}>
      {mensaje || MSG_SESION_EXPIRADA}
    </div>
  )
}
