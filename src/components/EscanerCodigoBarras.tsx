import { useEffect, useRef, useState } from 'react'

type Props = {
  activo: boolean
  onDetected: (codigo: string) => void
  onClose: () => void
}

type Fase = 'esperando' | 'https' | 'denegado' | 'sin_camara' | 'escanear'

let pedidoDesdeClick: Promise<true | 'denegado' | 'no_encontrada' | 'https'> | null = null

function conexionSegura() {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
  return window.location.protocol === 'https:'
}

function esIphone() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

async function pedirPermisoCamera(): Promise<true | 'denegado' | 'no_encontrada' | 'https'> {
  if (!conexionSegura()) return 'https'
  if (!navigator.mediaDevices?.getUserMedia) return 'no_encontrada'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
    })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((t) => t.stop())
        return true
      } catch (retry) {
        const retryName = retry instanceof DOMException ? retry.name : ''
        if (retryName === 'NotAllowedError' || retryName === 'PermissionDeniedError') return 'denegado'
        return 'no_encontrada'
      }
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denegado'
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'no_encontrada'
    return 'denegado'
  }
}

/** Llamar desde el clic del botón 📷 para que el navegador muestre el popup de permiso. */
export function dispararPedidoCamara() {
  pedidoDesdeClick = pedirPermisoCamera()
}

export function EscanerCodigoBarras({ activo, onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [fase, setFase] = useState<Fase>('esperando')
  const [reintento, setReintento] = useState(0)
  const cerrado = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  onDetectedRef.current = onDetected
  onCloseRef.current = onClose

  useEffect(() => {
    if (!activo) {
      pedidoDesdeClick = null
      setFase('esperando')
      setReintento(0)
      return
    }
    let vivo = true
    void (async () => {
      const pedido = pedidoDesdeClick ?? pedirPermisoCamera()
      pedidoDesdeClick = null
      const resultado = await pedido
      if (!vivo) return
      if (resultado === true) setFase('escanear')
      else if (resultado === 'https') setFase('https')
      else if (resultado === 'no_encontrada') setFase('sin_camara')
      else setFase('denegado')
    })()
    return () => {
      vivo = false
    }
  }, [activo, reintento])

  useEffect(() => {
    if (!activo || fase !== 'escanear') return
    cerrado.current = false
    let stop: (() => void) | null = null
    let vivo = true

    void (async () => {
      try {
        const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const hints = new Map()
        hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
          zxing.BarcodeFormat.EAN_13,
          zxing.BarcodeFormat.EAN_8,
          zxing.BarcodeFormat.QR_CODE,
          zxing.BarcodeFormat.CODE_128,
          zxing.BarcodeFormat.CODE_39,
        ])
        hints.set(zxing.DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints)
        const video = videoRef.current
        if (!video || !vivo) return
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video,
          (result) => {
            if (!result || cerrado.current) return
            const texto = result.getText().trim()
            if (!texto) return
            cerrado.current = true
            controls.stop()
            onDetectedRef.current(texto)
            onCloseRef.current()
          },
        )
        stop = () => controls.stop()
      } catch (error) {
        if (!vivo) return
        const name = error instanceof DOMException ? error.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') setFase('denegado')
        else setFase('sin_camara')
      }
    })()

    return () => {
      vivo = false
      stop?.()
    }
  }, [activo, fase])

  async function reintentar() {
    setFase('esperando')
    pedidoDesdeClick = pedirPermisoCamera()
    setReintento((n) => n + 1)
  }

  if (!activo) return null

  return (
    <div className="escaner-overlay" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <button className="escaner-cerrar" type="button" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>

      {fase === 'denegado' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon" aria-hidden>
            📷
          </p>
          <h2>Habilitá la cámara</h2>
          {esIphone() ? (
            <p>Configuración → Safari → Cámara → Permitir</p>
          ) : (
            <p>
              Tocá el ícono 🔒 en la barra de arriba
              <br />→ Permisos → Cámara → Permitir
            </p>
          )}
          <button className="escaner-card-btn" type="button" onClick={() => void reintentar()}>
            Ya lo hice, intentar de nuevo
          </button>
        </div>
      ) : null}

      {fase === 'https' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon" aria-hidden>
            📷
          </p>
          <h2>Habilitá la cámara</h2>
          <p>Abrí la app desde analitica360.app para usar la cámara.</p>
          <button className="escaner-card-btn" type="button" onClick={onClose}>
            Entendido
          </button>
        </div>
      ) : null}

      {fase === 'sin_camara' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon" aria-hidden>
            📷
          </p>
          <h2>No hay cámara</h2>
          <p>Escribí el código a mano en el buscador.</p>
          <button className="escaner-card-btn" type="button" onClick={onClose}>
            Entendido
          </button>
        </div>
      ) : null}

      {fase === 'escanear' ? (
        <>
          <div className="escaner-caja">
            <video ref={videoRef} className="escaner-video" muted playsInline autoPlay />
            <div className="escaner-marco" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <i className="escaner-linea" />
            </div>
          </div>
          <p className="escaner-texto">Apuntá la cámara al código de barras</p>
        </>
      ) : null}
    </div>
  )
}
