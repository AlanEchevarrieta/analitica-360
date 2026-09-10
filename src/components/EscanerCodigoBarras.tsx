import { useEffect, useRef, useState } from 'react'

type Props = {
  activo: boolean
  onDetected: (codigo: string) => void
  onClose: () => void
}

export function EscanerCodigoBarras({ activo, onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cerrado = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  onDetectedRef.current = onDetected
  onCloseRef.current = onClose

  useEffect(() => {
    if (!activo) return
    cerrado.current = false
    setError(null)
    let stop: (() => void) | null = null
    let vivo = true

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu dispositivo no tiene cámara disponible')
        return
      }
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
      } catch {
        if (vivo) setError('Tu dispositivo no tiene cámara disponible')
      }
    })()

    return () => {
      vivo = false
      stop?.()
    }
  }, [activo])

  if (!activo) return null

  return (
    <div className="escaner-overlay" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <button className="escaner-cerrar" type="button" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>
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
      {error ? (
        <p className="escaner-texto">{error}</p>
      ) : (
        <p className="escaner-texto">Apuntá la cámara al código de barras</p>
      )}
    </div>
  )
}
