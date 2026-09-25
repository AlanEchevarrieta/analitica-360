export type { LineaProducto as LineaVenta } from "@/features/productos/types";

export const FORMAS_PAGO = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "debito", etiqueta: "Débito" },
  { valor: "credito", etiqueta: "Crédito" },
  { valor: "qr", etiqueta: "Mercado Pago QR" },
] as const;

