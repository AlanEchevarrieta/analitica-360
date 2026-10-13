/** Qué hace el negocio: arma el menú (lo que no usa queda escondido, no bloqueado). Espejo de la API (configuracion.dto.ts). */
export type Actividad = "productos" | "produccion" | "servicios";

export const ACTIVIDADES: { valor: Actividad; icono: string; titulo: string; detalle: string }[] = [
  { valor: "productos", icono: "🛒", titulo: "Vendo productos", detalle: "Compro y revendo, o vendo lo que hago. Stock, compras y proveedores." },
  { valor: "produccion", icono: "🏭", titulo: "Fabrico o produzco", detalle: "Recetas, insumos y lo que cuesta fabricar." },
  { valor: "servicios", icono: "✂️", titulo: "Doy servicios", detalle: "Turnos, trabajos por encargo o reparaciones." },
];

/** Si todavía no se sabe (cargando o empresa sin dato), el menú se muestra como siempre. */
export const ACTIVIDADES_POR_DEFECTO: Actividad[] = ["productos", "produccion"];

/**
 * Rubros para el registro. `sugiere`: qué actividades se tildan solas al elegirlo
 * (el usuario las puede cambiar).
 */
export const RUBROS: { valor: string; etiqueta: string; sugiere: Actividad[] }[] = [
  { valor: "regionales", etiqueta: "Mates, regionales y artesanías", sugiere: ["productos", "produccion"] },
  { valor: "indumentaria", etiqueta: "Ropa, calzado y accesorios", sugiere: ["productos"] },
  { valor: "almacen", etiqueta: "Almacén, kiosco o dietética", sugiere: ["productos"] },
  { valor: "gastronomia", etiqueta: "Comida, panadería o pastelería", sugiere: ["productos", "produccion"] },
  { valor: "cosmetica", etiqueta: "Cosmética, perfumería o velas", sugiere: ["productos", "produccion"] },
  { valor: "hogar", etiqueta: "Hogar, deco y regalería", sugiere: ["productos"] },
  { valor: "libreria", etiqueta: "Librería, juguetería o bazar", sugiere: ["productos"] },
  { valor: "ferreteria", etiqueta: "Ferretería o materiales", sugiere: ["productos"] },
  { valor: "tecnologia", etiqueta: "Tecnología y celulares", sugiere: ["productos", "servicios"] },
  { valor: "mascotas", etiqueta: "Mascotas y veterinaria", sugiere: ["productos", "servicios"] },
  { valor: "peluqueria", etiqueta: "Peluquería, barbería o estética", sugiere: ["servicios", "productos"] },
  { valor: "salud", etiqueta: "Salud, consultorio o terapias", sugiere: ["servicios"] },
  { valor: "taller", etiqueta: "Taller, service técnico o reparaciones", sugiere: ["servicios", "productos"] },
  { valor: "deportes", etiqueta: "Gimnasio, clases o canchas", sugiere: ["servicios"] },
  { valor: "oficios", etiqueta: "Oficios y trabajos a domicilio", sugiere: ["servicios"] },
  { valor: "profesionales", etiqueta: "Servicios profesionales (estudio, agencia)", sugiere: ["servicios"] },
  { valor: "otro", etiqueta: "Otro", sugiere: ["productos"] },
];

export const ORIGENES = ["Instagram", "Facebook", "TikTok", "Google", "Me lo recomendaron", "Feria o evento", "Otro"] as const;

export const nombreRubro = (valor: string | null | undefined) => RUBROS.find((r) => r.valor === valor)?.etiqueta ?? valor ?? "—";
