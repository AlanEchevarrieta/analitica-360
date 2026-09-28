import { Suspense } from "react";
import { ConfirmacionPedido } from "@/components/ConfirmacionPedido";

export default function PedidoConfirmadoPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center">Cargando…</div>}>
      <ConfirmacionPedido />
    </Suspense>
  );
}
