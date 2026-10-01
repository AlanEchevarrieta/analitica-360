import Link from "next/link";
import { FileSpreadsheet, Percent, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductosListado } from "@/features/productos/components/ProductosListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Productos</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/productos/importar" className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheet aria-hidden /> Importar Excel
          </Link>
          <Link href="/productos/precios" className={buttonVariants({ variant: "outline" })}>
            <Percent aria-hidden /> Actualizar precios
          </Link>
          <Link href="/productos/nuevo" className={buttonVariants()}>
            <Plus aria-hidden /> Nuevo producto
          </Link>
        </div>
      </div>
      <ProductosListado />
    </div>
  );
}
