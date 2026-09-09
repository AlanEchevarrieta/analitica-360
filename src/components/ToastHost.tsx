import { useEffect, useState } from 'react'
import { MSG_SESION_EXPIRADA, suscribirToast } from '../lib/consulta'

export function ToastHost() {
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    return suscribirToast((texto) => {
      setMensaje(texto)
      window.setTimeout(() => setMensaje(null), 3000)
    })
  }, [])

  if (!mensaje) return null
  return (
    <div className="toast-sesion" role="status">
      {mensaje || MSG_SESION_EXPIRADA}
    </div>
  )
}
