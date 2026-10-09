// Formato de plata para los campos de la app (ver components/shared/input-plata.tsx).

/**
 * Texto "limpio" (el que reciben las pantallas: "1234567.5") a partir de lo que escribe la
 * persona ("$ 1.234.567,5"). La coma es el decimal; los puntos son miles. Un punto recién
 * tecleado al final (teclado numérico) también cuenta como decimal. Hasta 2 decimales.
 */
export function limpiarPlata(texto: string): string {
  let t = texto.replace(/[^\d.,]/g, "");
  if (t.endsWith(".") && !t.includes(",")) t = `${t.slice(0, -1)},`;
  const coma = t.indexOf(",");
  const entera = (coma === -1 ? t : t.slice(0, coma)).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (coma === -1) return entera;
  const decimales = t.slice(coma + 1).replace(/\D/g, "").slice(0, 2);
  return `${entera || "0"}.${decimales}`;
}

/** "1234567.5" (o "1.234.567,5") → "1.234.567,5", para mostrar. Respeta la coma recién escrita. */
export function formatearPlata(valor: string): string {
  if (!valor) return "";
  // Valores que vienen de la app ("1500.5", "1500.50") o ya con formato argentino ("1.500,5").
  const limpio = valor.includes(",") || /\.\d{3}(\D|$)/.test(valor) ? limpiarPlata(valor) : valor.replace(/[^\d.]/g, "");
  const [entera, decimales] = limpio.split(".");
  const conMiles = (entera || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales === undefined ? conMiles : `${conMiles},${decimales}`;
}
