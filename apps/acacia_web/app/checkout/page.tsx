import { obtenerConfigSitio } from "@/lib/api";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout Seguro · Acacia Mates",
  description: "Completá tus datos de envío y aboná tu pedido con 10% de descuento por transferencia o Mercado Pago.",
};

export default async function CheckoutPage() {
  const config = await obtenerConfigSitio();

  return <CheckoutView config={config} />;
}
