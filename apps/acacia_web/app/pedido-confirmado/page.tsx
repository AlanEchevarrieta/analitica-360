import { Suspense } from "react";
import { obtenerConfigSitio } from "@/lib/api";
import { PedidoConfirmadoView } from "@/components/pedido/PedidoConfirmadoView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedido Confirmado · Acacia Mates",
  description: "Tu pedido ha sido recibido con éxito en nuestro taller.",
};

export default async function PedidoConfirmadoPage() {
  const config = await obtenerConfigSitio();

  return (
    <Suspense
      fallback={
        <div className="py-24 text-center font-mono-spec text-xs tracking-widest text-[#6B6D69]">
          Cargando detalles de tu orden...
        </div>
      }
    >
      <PedidoConfirmadoView config={config} />
    </Suspense>
  );
}
