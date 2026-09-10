import { useMemo, useState } from 'react'
import { ImportarOperacionModal, PreviewTablaImport } from './ImportarOperacionModal'
import {
  descargarPlantillaCompras,
  etiquetaPreviewCompra,
  importarCompras,
  leerArchivoCompras,
  type FilaImportCompra,
} from '../lib/importarCompras'
import { requireSupabase } from '../lib/supabase'

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
  const listos = useMemo(() => filas.filter((f) => !f.error).length, [filas])
  const erroresN = filas.length - listos

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
        filas.length > 0 ? (
          <PreviewTablaImport
            headers={['Fila', 'Fecha', 'Proveedor', 'Productos', 'Estado']}
            listos={listos}
            errores={erroresN}
          >
            {filas.slice(0, 5).map((f) => (
              <tr
                key={f.filaExcel}
                className="text-[13px] text-[#F1F5F9]"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <td className="px-3 py-2">{f.filaExcel}</td>
                <td className="px-3 py-2 whitespace-nowrap">{etiquetaPreviewCompra(f)}</td>
                <td className="px-3 py-2">{f.proveedor || '—'}</td>
                <td className="px-3 py-2">{f.resumen || '—'}</td>
                <td className="px-3 py-2">
                  {f.error ? (
                    <span className="text-[#F87171]">{f.error}</span>
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
