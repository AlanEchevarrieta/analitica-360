import { useEffect, useMemo, useState } from 'react'
import { ImportarOperacionModal, PreviewTablaImport } from './ImportarOperacionModal'
import {
  aplicarCatalogoCompras,
  descargarPlantillaCompras,
  etiquetaPreviewCompra,
  etiquetaPreviewVariantesCompra,
  importarCompras,
  leerArchivoCompras,
  type FilaImportCompra,
} from '../lib/importarCompras'
import { requireSupabase } from '../lib/supabase'
import { listarVariantesDeProductos, type VarianteFila } from '../lib/variantes'

export function ImportarComprasModal({
  productos,
  onCerrar,
  onListo,
}: {
  productos: { id: string; nombre: string }[]
  onCerrar: () => void
  onListo: () => Promise<void>
}) {
  const [filas, setFilas] = useState<FilaImportCompra[]>([])
  const [variantes, setVariantes] = useState<VarianteFila[]>([])
  const ids = productos.map((p) => p.id).join(',')

  useEffect(() => {
    const lista = ids.split(',').filter(Boolean)
    if (lista.length === 0) {
      setVariantes([])
      return
    }
    void listarVariantesDeProductos(requireSupabase(), lista).then((res) => setVariantes(res.filas))
  }, [ids])

  const listas = useMemo(() => aplicarCatalogoCompras(filas, productos, variantes), [filas, productos, variantes])
  const listos = listas.filter((f) => !f.error).length
  const erroresN = listas.filter((f) => f.error).length

  return (
    <ImportarOperacionModal
      titulo="Importar compras"
      onCerrar={onCerrar}
      onPlantilla={descargarPlantillaCompras}
      listos={listos}
      onArchivo={async (file) => {
        const data = await leerArchivoCompras(file)
        if (data.length === 0) {
          setFilas([])
          return { ok: false, error: 'No encontramos filas de compras.' }
        }
        setFilas(data)
        return { ok: true }
      }}
      onConfirmar={async (onProgreso) => {
        const { importados, errores } = await importarCompras(
          requireSupabase(),
          filas,
          productos,
          onProgreso,
        )
        await onListo()
        return {
          toast: `✅ ${importados} compras importadas, ${errores.length} filas con errores`,
          errores: errores.map((e) => `Fila ${e.fila}: ${e.motivo}`),
        }
      }}
      preview={
        listas.length > 0 ? (
          <PreviewTablaImport
            headers={['Fila', 'Fecha', 'Proveedor', 'Productos', 'Variante', 'Estado']}
            listos={listos}
            errores={erroresN}
          >
            {listas.slice(0, 5).map((f) => (
              <tr
                key={f.filaExcel}
                className="text-[13px] text-[#F1F5F9]"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <td className="px-3 py-2">{f.filaExcel}</td>
                <td className="px-3 py-2 whitespace-nowrap">{etiquetaPreviewCompra(f)}</td>
                <td className="px-3 py-2">{f.proveedor || '—'}</td>
                <td className="px-3 py-2">{f.resumen || '—'}</td>
                <td className="px-3 py-2">{etiquetaPreviewVariantesCompra(f)}</td>
                <td className="px-3 py-2">
                  {f.error ? (
                    <span className="text-[#F87171]">{f.error}</span>
                  ) : f.advertencias.length > 0 ? (
                    <span className="text-[#FCD34D]">{f.advertencias.join(' ')}</span>
                  ) : (
                    <span className="text-[#4ADE80]">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </PreviewTablaImport>
        ) : null
      }
    />
  )
}
