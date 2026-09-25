import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DevolucionesListado } from "@/features/ventas/components/DevolucionesListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/ventas" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a ventas">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Devoluciones y cambios</h1>
      </div>
      <DevolucionesListado />
    </div>
  );
}
