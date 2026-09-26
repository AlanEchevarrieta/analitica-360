/** Rubros para el registro (sirven para adaptar la app y, más adelante, el módulo de producción). */
export const RUBROS = [
  { valor: "regionales", etiqueta: "Mates, regionales y artesanías" },
  { valor: "indumentaria", etiqueta: "Ropa, calzado y accesorios" },
  { valor: "almacen", etiqueta: "Almacén, kiosco o dietética" },
  { valor: "gastronomia", etiqueta: "Comida, panadería o pastelería" },
  { valor: "cosmetica", etiqueta: "Cosmética, perfumería o velas" },
  { valor: "hogar", etiqueta: "Hogar, deco y regalería" },
  { valor: "libreria", etiqueta: "Librería, juguetería o bazar" },
  { valor: "ferreteria", etiqueta: "Ferretería o materiales" },
  { valor: "tecnologia", etiqueta: "Tecnología y celulares" },
  { valor: "mascotas", etiqueta: "Mascotas y veterinaria" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export const ORIGENES = ["Instagram", "Facebook", "TikTok", "Google", "Me lo recomendaron", "Feria o evento", "Otro"] as const;

export const nombreRubro = (valor: string | null | undefined) => RUBROS.find((r) => r.valor === valor)?.etiqueta ?? valor ?? "—";
