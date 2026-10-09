import { CheckoutForm } from "@/components/CheckoutForm";
import { cabecerasTienda, urlTienda } from "@/lib/api";
import { cuentaActual } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";

/** ¿La tienda tiene su cuenta de Mercado Pago conectada? Si la API no responde, no se ofrece. */
async function aceptaMercadoPago(): Promise<boolean> {
  const sitio = await obtenerSitio();
  if (!sitio) return false;
  try {
    const res = await fetch(urlTienda(sitio.empresaId, "/condiciones"), { headers: await cabecerasTienda(), cache: "no-store" });
    return res.ok && Boolean(((await res.json()) as { mercadoPago?: boolean }).mercadoPago);
  } catch {
    return false;
  }
}

export default async function CheckoutPage() {
  // Con cuenta, el formulario viene completo y el pedido queda en "Mis pedidos".
  const [cuenta, mercadoPago] = await Promise.all([cuentaActual(), aceptaMercadoPago()]);
  return <CheckoutForm cuenta={cuenta} mercadoPago={mercadoPago} />;
}
