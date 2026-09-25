function limpiar(texto: string) {
  // "1.500,50" -> "1500.50"; "1500.5" queda igual (el punto solo es de miles si le siguen 3 dígitos).
  return texto.trim().replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
}

/** Número de un input de texto ("1.500,50" o "1500.5"); vacío o inválido = 0. */
export function aNumero(texto: string) {
  const n = Number(limpiar(texto));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Igual que aNumero pero distingue "sin cargar" (null) de 0: para precios y costos opcionales. */
export function aNumeroONull(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(limpiar(texto));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Valor numérico opcional -> texto para un input ("" si no hay valor). */
export function aTexto(valor: number | null | undefined) {
  return valor == null ? "" : String(valor);
}
