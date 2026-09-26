export type Rango = "semana" | "mes" | "mesPasado" | "90dias" | "anio" | "todo" | "personalizado";

export const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "semana", etiqueta: "Últimos 7 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "mesPasado", etiqueta: "Mes pasado" },
  { valor: "90dias", etiqueta: "Últimos 90 días" },
  { valor: "anio", etiqueta: "Este año" },
  { valor: "todo", etiqueta: "Todos los datos" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

/** "Todos los datos": desde antes de cualquier registro posible. */
export const INICIO_DATOS = "2000-01-01";

/** Fecha de hoy en Argentina (YYYY-MM-DD), independiente de la zona del navegador. */
export function hoyAR() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Mendoza" });
}

export function moverDias(iso: string, dias: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Desde/hasta de un rango. `personalizado` usa las fechas elegidas (o este mes si faltan). */
export function fechasDe(rango: Rango, personalizado?: { desde: string; hasta: string }): { desde: string; hasta: string } {
  const hoy = hoyAR();
  const [y, m] = hoy.split("-").map(Number);
  switch (rango) {
    case "semana":
      return { desde: moverDias(hoy, -6), hasta: hoy };
    case "mes":
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "mesPasado": {
      const desde = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      const hasta = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
      return { desde, hasta };
    }
    case "90dias":
      return { desde: moverDias(hoy, -89), hasta: hoy };
    case "anio":
      return { desde: `${y}-01-01`, hasta: hoy };
    case "todo":
      return { desde: INICIO_DATOS, hasta: hoy };
    case "personalizado": {
      const p = personalizado;
      if (!p?.desde || !p?.hasta) return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
      return p.desde <= p.hasta ? p : { desde: p.hasta, hasta: p.desde };
    }
  }
}

/** Días que abarca un período (inclusive). */
export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-09" o "2026-09-14" -> "sep" / "14 sep" para ejes de gráficos. */
export function etiquetaFecha(clave: string) {
  const [, m, d] = clave.split("-");
  const mes = MESES[Number(m) - 1] ?? clave;
  return d ? `${Number(d)} ${mes}` : mes;
}

export type Granularidad = "dia" | "semana" | "mes" | "anio";

/** Clave de agrupación de una fecha: el día, el lunes de su semana, el mes o el año. */
export function claveGranularidad(iso: string, g: Granularidad) {
  if (g === "dia") return iso;
  if (g === "mes") return iso.slice(0, 7);
  if (g === "anio") return iso.slice(0, 4);
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return moverDias(iso, dow === 0 ? -6 : 1 - dow);
}

/** Etiqueta corta para el eje según la granularidad. */
export function etiquetaGranularidad(clave: string, g: Granularidad) {
  if (g === "anio") return clave;
  if (g === "mes") {
    const [y, m] = clave.split("-");
    return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
  }
  return etiquetaFecha(clave);
}

/** Granularidad razonable para la cantidad de días del período. */
export function granularidadPara(dias: number): Granularidad {
  if (dias <= 45) return "dia";
  if (dias <= 200) return "semana";
  if (dias <= 1100) return "mes";
  return "anio";
}
