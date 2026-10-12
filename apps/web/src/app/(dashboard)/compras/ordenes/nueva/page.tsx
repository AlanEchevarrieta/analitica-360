import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NuevaOrdenCompra } from "@/features/ordenes-compra/components/NuevaOrdenCompra";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/compras/ordenes" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a órdenes de compra">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Nueva orden de compra</h1>
      </div>
      <NuevaOrdenCompra />
    </div>
  );
}
