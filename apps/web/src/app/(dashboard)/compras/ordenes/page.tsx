import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OrdenesCompraListado } from "@/features/ordenes-compra/components/OrdenesCompraListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/compras" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a compras">
            <ArrowLeft />
          </Link>
          <h1 className="text-xl font-semibold">Órdenes de compra</h1>
        </div>
        <Link href="/compras/ordenes/nueva" className={buttonVariants()}>
          <Plus aria-hidden /> Nueva orden
        </Link>
      </div>
      <OrdenesCompraListado />
    </div>
  );
}
