export type Rango = "mes" | "mesPasado" | "90dias" | "anio";

export const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "mesPasado", etiqueta: "Mes pasado" },
  { valor: "90dias", etiqueta: "Últimos 90 días" },
  { valor: "anio", etiqueta: "Este año" },
];

/** Fecha de hoy en Argentina (YYYY-MM-DD), independiente de la zona del navegador. */
export function hoyAR() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Mendoza" });
}

function mover(iso: string, dias: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function fechasDe(rango: Rango): { desde: string; hasta: string } {
  const hoy = hoyAR();
  const [y, m] = hoy.split("-").map(Number);
  switch (rango) {
    case "mes":
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "mesPasado": {
      const desde = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      const hasta = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
      return { desde, hasta };
    }
    case "90dias":
      return { desde: mover(hoy, -89), hasta: hoy };
    case "anio":
      return { desde: `${y}-01-01`, hasta: hoy };
  }
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-09" o "2026-09-14" -> "sep" / "14 sep" para ejes de gráficos. */
export function etiquetaFecha(clave: string) {
  const [, m, d] = clave.split("-");
  const mes = MESES[Number(m) - 1] ?? clave;
  return d ? `${Number(d)} ${mes}` : mes;
}
