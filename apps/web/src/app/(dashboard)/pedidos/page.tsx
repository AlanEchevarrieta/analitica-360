import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PedidosListado } from "@/features/pedidos/components/PedidosListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Link href="/pedidos/nuevo" className={buttonVariants()}>
          <Plus aria-hidden /> Nuevo pedido
        </Link>
      </div>
      <PedidosListado />
    </div>
  );
}
