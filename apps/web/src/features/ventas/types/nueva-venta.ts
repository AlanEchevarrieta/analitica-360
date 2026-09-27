export type { LineaProducto as LineaVenta } from "@/features/productos/types";

export const FORMAS_PAGO = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "debito", etiqueta: "Débito" },
  { valor: "credito", etiqueta: "Crédito" },
  { valor: "qr", etiqueta: "Mercado Pago QR" },
] as const;

/** Para mostrar el medio de una venta: los de cobro más "a cuenta" (fiado). */
export const ETIQUETAS_PAGO: { valor: string; etiqueta: string }[] = [...FORMAS_PAGO, { valor: "cuenta_corriente", etiqueta: "A cuenta (fiado)" }];
export const etiquetaPago = (v: string) => ETIQUETAS_PAGO.find((f) => f.valor === v)?.etiqueta ?? v;
