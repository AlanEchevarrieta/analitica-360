import { useEffect, useRef, useState } from 'react'

type Props = {
  activo: boolean
  onDetected: (codigo: string) => void
  onClose: () => void
}

type Fase = 'https' | 'pedir' | 'denegado' | 'sin_camara' | 'escanear'

function conexionSegura() {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
  return window.location.protocol === 'https:'
}

async function pedirPermisoCamera(): Promise<true | 'denegado' | 'no_encontrada' | 'error'> {
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
        if (retryName === 'NotFoundError' || retryName === 'DevicesNotFoundError') return 'no_encontrada'
        return 'error'
      }
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denegado'
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'no_encontrada'
    return 'error'
  }
}

export function EscanerCodigoBarras({ activo, onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [fase, setFase] = useState<Fase>('pedir')
  const [esperando, setEsperando] = useState(false)
  const cerrado = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  onDetectedRef.current = onDetected
  onCloseRef.current = onClose

  useEffect(() => {
    if (!activo) {
      setEsperando(false)
      return
    }
    setFase(conexionSegura() ? 'pedir' : 'https')
  }, [activo])

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

  async function activarCamara() {
    if (!conexionSegura()) {
      setFase('https')
      return
    }
    setEsperando(true)
    const resultado = await pedirPermisoCamera()
    setEsperando(false)
    if (resultado === true) setFase('escanear')
    else if (resultado === 'denegado') setFase('denegado')
    else if (resultado === 'no_encontrada') setFase('sin_camara')
    else setFase('denegado')
  }

  if (!activo) return null

  return (
    <div className="escaner-overlay" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <button className="escaner-cerrar" type="button" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>

      {fase === 'pedir' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon" aria-hidden>
            📷
          </p>
          <h2>Necesitamos acceso a tu cámara</h2>
          <p>
            Para escanear códigos de barras, permití el acceso a la cámara cuando el navegador te lo
            solicite
          </p>
          <button className="escaner-card-btn" type="button" disabled={esperando} onClick={() => void activarCamara()}>
            {esperando ? 'Esperando permiso…' : 'Activar cámara'}
          </button>
        </div>
      ) : null}

      {fase === 'https' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon" aria-hidden>
            📷
          </p>
          <h2>Conexión no segura</h2>
          <p>
            El escáner solo funciona con conexión segura (HTTPS). Tu app en analitica360.app lo
            soporta.
          </p>
          <button className="escaner-card-btn" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      ) : null}

      {fase === 'denegado' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon" aria-hidden>
            ⚠️
          </p>
          <h2>Cámara bloqueada</h2>
          <p>Para usar el escáner necesitás habilitar la cámara manualmente:</p>
          <ul className="escaner-pasos">
            <li>
              <strong>Android Chrome:</strong> Tocá el ícono 🔒 en la barra de dirección → Permisos →
              Cámara → Permitir
            </li>
            <li>
              <strong>iPhone Safari:</strong> Configuración → Safari → Cámara → Permitir
            </li>
          </ul>
          <button className="escaner-card-btn" type="button" onClick={onClose}>
            Entendido
          </button>
        </div>
      ) : null}

      {fase === 'sin_camara' ? (
        <div className="escaner-card">
          <p className="escaner-card-icon escaner-card-icon-off" aria-hidden>
            📷
          </p>
          <h2>Sin cámara disponible</h2>
          <p>Este dispositivo no tiene cámara. Ingresá el código manualmente en el buscador.</p>
          <button className="escaner-card-btn" type="button" onClick={onClose}>
            Cerrar
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
