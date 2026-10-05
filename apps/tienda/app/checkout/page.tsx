import { CheckoutForm } from "@/components/CheckoutForm";
import { cuentaActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Con cuenta, el formulario viene completo y el pedido queda en "Mis pedidos".
  return <CheckoutForm cuenta={await cuentaActual()} />;
}
