const MAX_BYTES = 5 * 1024 * 1024

const MIME_PERMITIDOS = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

/** Valida tamaño, extensión y MIME antes de pasar el archivo a SheetJS. */
export function errorArchivoImportacion(file: File): string | null {
  const nombre = file.name.toLowerCase()
  if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.csv')) {
    return 'Solo se aceptan archivos .xlsx o .csv'
  }
  if (file.size > MAX_BYTES) {
    return 'El archivo no puede superar 5MB'
  }
  if (!MIME_PERMITIDOS.includes(file.type)) {
    return 'Solo se aceptan archivos .xlsx o .csv'
  }
  return null
}
