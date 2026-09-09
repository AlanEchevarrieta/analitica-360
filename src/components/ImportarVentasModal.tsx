import { useMemo, useState } from 'react'
import { ImportarOperacionModal, PreviewTablaImport } from './ImportarOperacionModal'
import {
  aplicarCatalogoVentas,
  descargarPlantillaVentas,
  importarVentas,
  leerArchivoVentas,
  etiquetaPreviewVenta,
  type FilaImportVenta,
} from '../lib/importarVentas'
import { requireSupabase } from '../lib/supabase'

export function ImportarVentasModal({
  productos,
  onCerrar,
  onListo,
}: {
  productos: { id: string; nombre: string }[]
  onCerrar: () => void
  onListo: () => Promise<void>
}) {
  const [filas, setFilas] = useState<FilaImportVenta[]>([])
  const listas = useMemo(() => aplicarCatalogoVentas(filas, productos), [filas, productos])
  const listos = listas.filter((f) => !f.error).length
  const erroresN = listas.filter((f) => f.error).length

  return (
    <ImportarOperacionModal
      titulo="Importar ventas"
      onCerrar={onCerrar}
      onPlantilla={descargarPlantillaVentas}
      listos={listos}
      onArchivo={async (file) => {
        const data = await leerArchivoVentas(file)
        if (data.length === 0) {
          setFilas([])
          return { ok: false, error: 'No encontramos filas de ventas.' }
        }
        setFilas(data)
        return { ok: true }
      }}
      onConfirmar={async () => {
        const { importados, errores } = await importarVentas(requireSupabase(), filas, productos)
        await onListo()
        return {
          toast: `✅ ${importados} ventas importadas, ${errores.length} filas con errores`,
          errores: errores.map((e) => `Fila ${e.fila}: ${e.motivo}`),
        }
      }}
      preview={
        listas.length > 0 ? (
          <PreviewTablaImport
            headers={['Fila', 'Fecha', 'Productos', 'Pago', 'Cliente', 'Estado']}
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
                <td className="px-3 py-2 whitespace-nowrap">{etiquetaPreviewVenta(f)}</td>
                <td className="px-3 py-2">{f.resumen || '—'}</td>
                <td className="px-3 py-2">{f.formaLabel || '—'}</td>
                <td className="px-3 py-2">{f.cliente || '—'}</td>
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
