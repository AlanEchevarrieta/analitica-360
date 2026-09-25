/**
 * Paletas de color elegibles (se aplican con data-paleta en <html>; los
 * colores viven en src/styles/paletas.css). La elección se guarda en una
 * cookie del navegador (preferencia de cada dispositivo, como claro/oscuro):
 * así el servidor ya manda el <html> con la paleta y no hay parpadeo.
 */
export const PALETAS = [
  { clave: "indigo", nombre: "Índigo", descripcion: "El clásico de Analítica 360", muestra: ["#6366f1", "#4ade80", "#f59e0b"] },
  { clave: "acacia", nombre: "Acacia", descripcion: "Terracota y verde oliva", muestra: ["#c2410c", "#4d7c0f", "#ca8a04"] },
  { clave: "bosque", nombre: "Bosque", descripcion: "Verde esmeralda", muestra: ["#059669", "#2563eb", "#d97706"] },
  { clave: "oceano", nombre: "Océano", descripcion: "Azul y celeste", muestra: ["#0284c7", "#16a34a", "#d97706"] },
  { clave: "grafito", nombre: "Grafito", descripcion: "Grises sobrios", muestra: ["#27272a", "#2563eb", "#16a34a"] },
] as const;

export type ClavePaleta = (typeof PALETAS)[number]["clave"];

export const PALETA_DEFAULT: ClavePaleta = "indigo";
export const COOKIE_PALETA = "a360-paleta";

export function esPaleta(v: unknown): v is ClavePaleta {
  return PALETAS.some((p) => p.clave === v);
}
