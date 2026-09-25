import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductoEditor } from "@/features/productos/components/ProductoEditor";

export default async function Page(props: PageProps<"/productos/[id]">) {
  const { id } = await props.params;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/productos" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a productos">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Editar producto</h1>
      </div>
      <ProductoEditor id={id} />
    </div>
  );
}
