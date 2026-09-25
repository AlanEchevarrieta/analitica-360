import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NuevoPedidoForm } from "@/features/pedidos/components/NuevoPedidoForm";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/pedidos" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a pedidos">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Nuevo pedido</h1>
      </div>
      <NuevoPedidoForm />
    </div>
  );
}
