/** Archivo de documentos del negocio: tipos aceptados, límites y avisos de vencimiento. */

export const CATEGORIAS_ARCHIVO = ['factura_proveedor', 'contrato', 'habilitacion', 'seguro', 'constancia', 'otro'] as const;
export type CategoriaArchivo = (typeof CATEGORIAS_ARCHIVO)[number];
export const ENTIDADES_ARCHIVO = ['empresa', 'proveedor', 'cliente', 'compra'] as const;
export type EntidadArchivo = (typeof ENTIDADES_ARCHIVO)[number];

/** Tope por archivo. */
export const MAXIMO_ARCHIVO = 20 * 1024 * 1024;
/** Espacio por empresa (decidido el 2026-10-11: 10 GB en Pro y E-commerce; el Básico no tiene archivo). */
export const ESPACIO_POR_EMPRESA = 10 * 1024 ** 3;

const empieza = (b: Buffer, ...bytes: number[]) => bytes.every((x, i) => b[i] === x);

/**
 * Qué es el archivo según sus primeros bytes (no por la extensión, que se puede
 * cambiar). Acepta PDF, fotos (JPG, PNG, WEBP), Word y Excel; el resto, no.
 */
export function tipoDeArchivo(contenido: Buffer, nombre: string): { extension: string; mime: string } | null {
  const ext = (nombre.split('.').pop() ?? '').toLowerCase();
  if (empieza(contenido, 0x25, 0x50, 0x44, 0x46)) return { extension: 'pdf', mime: 'application/pdf' };
  if (empieza(contenido, 0xff, 0xd8, 0xff)) return { extension: 'jpg', mime: 'image/jpeg' };
  if (empieza(contenido, 0x89, 0x50, 0x4e, 0x47)) return { extension: 'png', mime: 'image/png' };
  if (empieza(contenido, 0x52, 0x49, 0x46, 0x46) && contenido.subarray(8, 12).toString('latin1') === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  // Word y Excel nuevos son un ZIP; se distinguen por la extensión.
  if (empieza(contenido, 0x50, 0x4b, 0x03, 0x04)) {
    if (ext === 'docx') return { extension: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (ext === 'xlsx') return { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    return null;
  }
  // Word y Excel viejos (.doc, .xls).
  if (empieza(contenido, 0xd0, 0xcf, 0x11, 0xe0)) {
    if (ext === 'doc') return { extension: 'doc', mime: 'application/msword' };
    if (ext === 'xls') return { extension: 'xls', mime: 'application/vnd.ms-excel' };
    return null;
  }
  return null;
}

export const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/**
 * Qué aviso toca hoy: '30' si faltan entre 8 y 30 días y no se avisó; '7' si
 * faltan 7 días o menos (incluido el día que vence) y no se avisó. Lo vencido
 * no se manda por email (se ve en Inicio).
 */
export function avisoQueToca(vence: string | null, hoy: string, avisado30: boolean, avisado7: boolean): '30' | '7' | null {
  if (!vence) return null;
  const faltan = diasEntre(hoy, vence);
  if (faltan < 0) return null;
  if (faltan <= 7) return avisado7 ? null : '7';
  if (faltan <= 30) return avisado30 ? null : '30';
  return null;
}

/** Estado para mostrar: vencido, por vencer (30 días) o vigente. */
export function estadoVencimiento(vence: string | null, hoy: string): 'vencido' | 'por_vencer' | 'vigente' | null {
  if (!vence) return null;
  const faltan = diasEntre(hoy, vence);
  return faltan < 0 ? 'vencido' : faltan <= 30 ? 'por_vencer' : 'vigente';
}

/** "Contrato_alquiler (1).pdf" → nombre seguro para el header de descarga. */
export function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 150) || 'documento';
}
