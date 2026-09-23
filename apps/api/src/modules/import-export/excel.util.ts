/**
 * Puerto fiel de las funciones de celda/columna de src/lib/excelOperaciones.ts
 * (parseo y normalización de valores ya extraídos de una fila de Excel/CSV).
 *
 * Lo que queda afuera de este puerto es todo lo que toca APIs de navegador:
 * `leerMatrizExcel`/`descargarPlantilla` (File, xlsx.writeFile - disparan una
 * descarga en el browser) y `validarArchivoImportacion.ts` (valida un `File`
 * antes de subirlo). El futuro frontend Next.js sigue parseando el archivo
 * client-side (con `xlsx`/`papaparse`, igual que el legacy) y manda la
 * matriz ya parseada (header + filas) al backend - acá SÍ se revalida y
 * coerciona cada celda, nunca se confía en que el cliente ya lo hizo bien.
 */

/** Puerto de claveNombre: normaliza un nombre para comparar duplicados. */
export function claveNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Puerto de numeroCelda: parsea "1.234,56" / "1234.56" / "$ 1234" -> number, 0 si no es válido. */
export function numeroCelda(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  let s = String(v ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\$/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Puerto de enteroCelda: numeroCelda truncado y no negativo. */
export function enteroCelda(v: unknown): number {
  return Math.max(0, Math.trunc(numeroCelda(v)));
}

/** Puerto de textoCelda. */
export function textoCelda(v: unknown): string {
  return String(v ?? '').trim();
}

/** Puerto de celdaEsNumero. */
export function celdaEsNumero(v: unknown): boolean {
  if (typeof v === 'number' && Number.isFinite(v)) return true;
  const s = textoCelda(v);
  if (!s) return false;
  return /^-?\d+([.,]\d+)?$/.test(s.replace(/\s/g, '').replace(/\$/g, ''));
}

/** Puerto de claveColumna: normaliza un encabezado para matchear columnas sin depender de tildes/mayúsculas. */
export function claveColumna(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Puerto de parseFechaCelda: Date de xlsx, número de serie de Excel, ISO o DD/MM/AAAA -> YYYY-MM-DD, o null. */
export function parseFechaCelda(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const utc = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }
  const s = textoCelda(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${pad2(month)}-${pad2(day)}`;
  }
  return null;
}
