/** Unidades de medida de productos e insumos (igual que la API). */
export const UNIDADES = [
  { valor: "unidad", etiqueta: "Unidades", corta: "u." },
  { valor: "kg", etiqueta: "Kilos (kg)", corta: "kg" },
  { valor: "g", etiqueta: "Gramos (g)", corta: "g" },
  { valor: "l", etiqueta: "Litros (l)", corta: "l" },
  { valor: "ml", etiqueta: "Mililitros (ml)", corta: "ml" },
  { valor: "m", etiqueta: "Metros (m)", corta: "m" },
  { valor: "cm", etiqueta: "Centímetros (cm)", corta: "cm" },
] as const;

export const abreviaturaUnidad = (valor: string | null | undefined) => UNIDADES.find((u) => u.valor === valor)?.corta ?? valor ?? "u.";
