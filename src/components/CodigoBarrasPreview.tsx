import { useEffect, useRef } from 'react'

export function CodigoBarrasPreview({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const codigo = valor.trim()

  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    if (!codigo) {
      svg.replaceChildren()
      return
    }
    let cancel = false
    void (async () => {
      const JsBarcode = (await import('jsbarcode')).default
      if (cancel || !ref.current) return
      try {
        JsBarcode(ref.current, codigo, {
          format: 'CODE128',
          width: 2,
          height: 56,
          displayValue: true,
          fontSize: 14,
          margin: 4,
          background: '#ffffff',
          lineColor: '#1A2F4A',
          font: 'Inter, system-ui, sans-serif',
        })
      } catch {
        ref.current.replaceChildren()
      }
    })()
    return () => {
      cancel = true
    }
  }, [codigo])

  if (!codigo) return null

  return (
    <div
      className="mt-2 flex justify-center overflow-hidden rounded-md border border-[#E2E8F0] bg-white p-2"
      style={{ width: 200, height: 80 }}
    >
      <svg
        ref={ref}
        role="img"
        aria-label={`Código de barras ${codigo}`}
        style={{ width: 184, height: 72 }}
      />
    </div>
  )
}
