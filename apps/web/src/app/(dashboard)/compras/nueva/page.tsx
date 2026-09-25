import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NuevaCompraForm } from "@/features/compras/components/NuevaCompraForm";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/compras" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a compras">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Nueva compra</h1>
      </div>
      <NuevaCompraForm />
    </div>
  );
}
