import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ComprasListado } from "@/features/compras/components/ComprasListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Compras</h1>
        <div className="flex gap-2">
          <Link href="/compras/ordenes" className={buttonVariants({ variant: "outline" })}>
            Órdenes de compra
          </Link>
          <Link href="/compras/nueva" className={buttonVariants()}>
            <Plus aria-hidden /> Nueva compra
          </Link>
        </div>
      </div>
      <ComprasListado />
    </div>
  );
}
