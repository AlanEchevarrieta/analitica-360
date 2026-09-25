export interface LineaVenta {
  /** productoId + varianteId: una línea por combinación. */
  clave: string;
  productoId: string;
  varianteId: string | null;
  nombre: string;
  variante: string | null;
  precioUnitario: number;
  cantidad: number;
  /** Stock del producto al momento de agregarlo (para avisar, no bloquea). */
  stock: number;
}

export const FORMAS_PAGO = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "debito", etiqueta: "Débito" },
  { valor: "credito", etiqueta: "Crédito" },
  { valor: "qr", etiqueta: "QR" },
] as const;

export function etiquetaVariante(atributos: Record<string, string>) {
  return Object.values(atributos).filter(Boolean).join(" / ");
}
