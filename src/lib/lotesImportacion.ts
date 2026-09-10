export const LOTE_IMPORTACION = 50
export const TIMEOUT_LOTE_MS = 30_000

export function mensajeErrorImportacion(error: unknown) {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message ?? '')
  }
  return String(error)
}

export function esFuncionImportacionFaltante(error: unknown) {
  const t = mensajeErrorImportacion(error).toLowerCase()
  return (
    t.includes('could not find the function') ||
    t.includes('schema cache') ||
    t.includes('pgrst202') ||
    t.includes('does not exist')
  )
}

export async function ejecutarLoteConRetry<T>(accion: () => Promise<T>): Promise<T> {
  const conTimeout = () =>
    Promise.race([
      accion(),
      new Promise<never>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error('timeout')), TIMEOUT_LOTE_MS)
      }),
    ])
  try {
    return await conTimeout()
  } catch (error) {
    if (esFuncionImportacionFaltante(error)) throw error
    return await accion()
  }
}

export function partirEnLotes<T>(filas: T[], tamano = LOTE_IMPORTACION): T[][] {
  const out: T[][] = []
  for (let i = 0; i < filas.length; i += tamano) {
    out.push(filas.slice(i, i + tamano))
  }
  return out
}

export type ProgresoImportacion = (hechos: number, total: number) => void
