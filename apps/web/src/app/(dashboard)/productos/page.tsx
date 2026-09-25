import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductosListado } from "@/features/productos/components/ProductosListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Productos</h1>
        <Link href="/productos/nuevo" className={buttonVariants()}>
          <Plus aria-hidden /> Nuevo producto
        </Link>
      </div>
      <ProductosListado />
    </div>
  );
}
